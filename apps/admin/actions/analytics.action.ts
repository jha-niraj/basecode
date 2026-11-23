"use server"

import { db } from "@repo/db"
import { adminAccess, adminAuditLog, aiUsageLogs, paymentEvent, user } from "@repo/db/schema"
import { and, count, desc, eq, gte, sql } from "@repo/db"
import { errorText, requireAdminAction } from "./guard"

interface Response<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

/** Counts in explicit windows (AGENTS.md section 9) - never a bare total quoted as "today's". */
export interface WindowedCount {
    today: number
    last7: number
    last30: number
    allTime: number
}

export interface DailyPoint {
    /** YYYY-MM-DD, UTC */
    day: string
    value: number
}

export interface AnalyticsData {
    signups: WindowedCount
    /** Active admin accounts right now (a state, not a window). */
    activeAdmins: number
    adminActions: WindowedCount
    /** New users per UTC day, the last 30 days, oldest first (zero days included - a day with none is a real 0). */
    dailySignups: DailyPoint[]
    /** Users who have verified their email / all users. */
    verifiedUsers: number
    generatedAt: string
}

const DAY = 24 * 60 * 60 * 1000

function startOfUtcDay(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** The last `days` UTC days as YYYY-MM-DD, oldest first. */
function dayKeys(days: number, now: Date): string[] {
    const today = startOfUtcDay(now).getTime()
    return Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10))
}

function fillDays(keys: string[], rows: { day: string; value: number }[]): DailyPoint[] {
    const by = new Map(rows.map((r) => [r.day, Number(r.value)]))
    return keys.map((day) => ({ day, value: by.get(day) ?? 0 }))
}

export async function getAnalyticsData(): Promise<Response<AnalyticsData>> {
    try {
        await requireAdminAction("analytics", "read")
        const now = new Date()
        const today = startOfUtcDay(now)
        const d7 = new Date(today.getTime() - 6 * DAY)
        const d30 = new Date(today.getTime() - 29 * DAY)
        const dayExpr = sql<string>`to_char(${user.createdAt}, 'YYYY-MM-DD')`

        const [
            [usersToday], [users7], [users30], [usersAll], [verified],
            [admins],
            [actsToday], [acts7], [acts30], [actsAll],
            daily,
        ] = await Promise.all([
            db.select({ c: count() }).from(user).where(gte(user.createdAt, today)),
            db.select({ c: count() }).from(user).where(gte(user.createdAt, d7)),
            db.select({ c: count() }).from(user).where(gte(user.createdAt, d30)),
            db.select({ c: count() }).from(user),
            db.select({ c: count() }).from(user).where(eq(user.emailVerified, true)),
            db.select({ c: count() }).from(adminAccess).where(eq(adminAccess.status, "ACTIVE")),
            db.select({ c: count() }).from(adminAuditLog).where(gte(adminAuditLog.createdAt, today)),
            db.select({ c: count() }).from(adminAuditLog).where(gte(adminAuditLog.createdAt, d7)),
            db.select({ c: count() }).from(adminAuditLog).where(gte(adminAuditLog.createdAt, d30)),
            db.select({ c: count() }).from(adminAuditLog),
            db.select({ day: dayExpr, value: count() }).from(user).where(gte(user.createdAt, d30)).groupBy(dayExpr),
        ])

        return {
            success: true,
            data: {
                signups: { today: usersToday?.c ?? 0, last7: users7?.c ?? 0, last30: users30?.c ?? 0, allTime: usersAll?.c ?? 0 },
                activeAdmins: admins?.c ?? 0,
                adminActions: { today: actsToday?.c ?? 0, last7: acts7?.c ?? 0, last30: acts30?.c ?? 0, allTime: actsAll?.c ?? 0 },
                dailySignups: fillDays(dayKeys(30, now), daily),
                verifiedUsers: verified?.c ?? 0,
                generatedAt: now.toISOString(),
            },
        }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not load analytics") }
    }
}

// ─── Financial: payments received + AI spend ───────────────────────────────────

export interface MoneyByCurrency {
    currency: string
    /** Integer minor units (cents). */
    last30Minor: number
    allTimeMinor: number
}

export interface PaymentRow {
    id: string
    type: string
    status: string
    amountMinor: number | null
    currency: string | null
    livemode: boolean
    receivedAt: string
    error: string | null
}

export interface FinancialReport {
    /** Payment events that carry an amount and were processed, per currency. Empty = no payments recorded yet. */
    payments: MoneyByCurrency[]
    paymentEvents: { last30: number; allTime: number; failedLast30: number }
    /** AI spend in micro-USD (1e-6 USD). */
    aiSpend: { last30Micro: number; allTimeMicro: number; requestsLast30: number }
    /** AI spend per UTC day, the last 30 days, micro-USD. */
    dailyAiSpend: DailyPoint[]
    recentPayments: PaymentRow[]
    generatedAt: string
}

export async function getFinancialReport(): Promise<Response<FinancialReport>> {
    try {
        await requireAdminAction("analytics", "read")
        const now = new Date()
        const d30 = new Date(startOfUtcDay(now).getTime() - 29 * DAY)
        const aiDay = sql<string>`to_char(${aiUsageLogs.createdAt}, 'YYYY-MM-DD')`
        const amount = sql<number>`coalesce(sum(${paymentEvent.amountMinor}), 0)::bigint`
        const sum30 = sql<number>`coalesce(sum(case when ${paymentEvent.receivedAt} >= ${d30.toISOString()}::timestamp then ${paymentEvent.amountMinor} else 0 end), 0)::bigint`
        const processed = and(eq(paymentEvent.status, "processed"), sql`${paymentEvent.amountMinor} is not null`)

        const [money, [ev30], [evAll], [failed30], [ai30], [aiAll], aiDaily, recent] = await Promise.all([
            db.select({ currency: paymentEvent.currency, last30: sum30, all: amount })
                .from(paymentEvent).where(processed).groupBy(paymentEvent.currency),
            db.select({ c: count() }).from(paymentEvent).where(gte(paymentEvent.receivedAt, d30)),
            db.select({ c: count() }).from(paymentEvent),
            db.select({ c: count() }).from(paymentEvent).where(and(gte(paymentEvent.receivedAt, d30), eq(paymentEvent.status, "failed"))),
            db.select({ micro: sql<number>`coalesce(sum(${aiUsageLogs.costMicroUsd}), 0)::bigint`, c: count() })
                .from(aiUsageLogs).where(gte(aiUsageLogs.createdAt, d30)),
            db.select({ micro: sql<number>`coalesce(sum(${aiUsageLogs.costMicroUsd}), 0)::bigint` }).from(aiUsageLogs),
            db.select({ day: aiDay, value: sql<number>`coalesce(sum(${aiUsageLogs.costMicroUsd}), 0)::bigint` })
                .from(aiUsageLogs).where(gte(aiUsageLogs.createdAt, d30)).groupBy(aiDay),
            db.query.paymentEvent.findMany({
                orderBy: [desc(paymentEvent.receivedAt)],
                limit: 50,
                columns: { id: true, type: true, status: true, amountMinor: true, currency: true, livemode: true, receivedAt: true, error: true },
            }),
        ])

        return {
            success: true,
            data: {
                payments: money.map((m) => ({
                    currency: (m.currency ?? "unknown").toUpperCase(),
                    last30Minor: Number(m.last30),
                    allTimeMinor: Number(m.all),
                })),
                paymentEvents: { last30: ev30?.c ?? 0, allTime: evAll?.c ?? 0, failedLast30: failed30?.c ?? 0 },
                aiSpend: { last30Micro: Number(ai30?.micro ?? 0), allTimeMicro: Number(aiAll?.micro ?? 0), requestsLast30: ai30?.c ?? 0 },
                dailyAiSpend: fillDays(dayKeys(30, now), aiDaily.map((r) => ({ day: r.day, value: Number(r.value) }))),
                recentPayments: recent.map((r) => ({ ...r, receivedAt: r.receivedAt.toISOString() })),
                generatedAt: now.toISOString(),
            },
        }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not load the financial report") }
    }
}

// ─── Admin activity report ─────────────────────────────────────────────────────

export interface AdminActivityRow {
    adminId: string
    name: string
    email: string
    role: string
    last30: number
    allTime: number
    lastActionAt: string | null
}

export interface AdminActivityReport {
    actions: WindowedCount
    /** Actions per UTC day, last 30 days. */
    daily: DailyPoint[]
    /** Actions per module, last 30 days. */
    byModule: { module: string; count: number }[]
    admins: AdminActivityRow[]
    generatedAt: string
}

export async function getAdminActivityReport(): Promise<Response<AdminActivityReport>> {
    try {
        await requireAdminAction("analytics", "read")
        const now = new Date()
        const today = startOfUtcDay(now)
        const d7 = new Date(today.getTime() - 6 * DAY)
        const d30 = new Date(today.getTime() - 29 * DAY)
        const dayExpr = sql<string>`to_char(${adminAuditLog.createdAt}, 'YYYY-MM-DD')`
        const recent30 = sql<number>`count(*) filter (where ${adminAuditLog.createdAt} >= ${d30.toISOString()}::timestamp)`

        const [[a0], [a7], [a30], [aAll], daily, byModule, perAdmin, admins] = await Promise.all([
            db.select({ c: count() }).from(adminAuditLog).where(gte(adminAuditLog.createdAt, today)),
            db.select({ c: count() }).from(adminAuditLog).where(gte(adminAuditLog.createdAt, d7)),
            db.select({ c: count() }).from(adminAuditLog).where(gte(adminAuditLog.createdAt, d30)),
            db.select({ c: count() }).from(adminAuditLog),
            db.select({ day: dayExpr, value: count() }).from(adminAuditLog).where(gte(adminAuditLog.createdAt, d30)).groupBy(dayExpr),
            db.select({ module: adminAuditLog.module, count: count() }).from(adminAuditLog)
                .where(gte(adminAuditLog.createdAt, d30)).groupBy(adminAuditLog.module),
            db.select({
                adminId: adminAuditLog.adminId,
                last30: recent30,
                allTime: count(),
                lastAt: sql<Date | null>`max(${adminAuditLog.createdAt})`,
            }).from(adminAuditLog).groupBy(adminAuditLog.adminId),
            db.select({ id: adminAccess.id, role: adminAccess.adminRole, name: user.name, email: user.email })
                .from(adminAccess).leftJoin(user, eq(user.id, adminAccess.userId)),
        ])

        const stats = new Map(perAdmin.map((p) => [p.adminId, p]))
        return {
            success: true,
            data: {
                actions: { today: a0?.c ?? 0, last7: a7?.c ?? 0, last30: a30?.c ?? 0, allTime: aAll?.c ?? 0 },
                daily: fillDays(dayKeys(30, now), daily),
                byModule: byModule.map((m) => ({ module: m.module, count: m.count })).sort((x, y) => y.count - x.count),
                admins: admins
                    .map((a): AdminActivityRow => {
                        const s = stats.get(a.id)
                        const last = s?.lastAt ? new Date(s.lastAt) : null
                        return {
                            adminId: a.id,
                            name: a.name ?? "",
                            email: a.email ?? "",
                            role: a.role,
                            last30: Number(s?.last30 ?? 0),
                            allTime: Number(s?.allTime ?? 0),
                            lastActionAt: last ? last.toISOString() : null,
                        }
                    })
                    .sort((x, y) => y.last30 - x.last30 || y.allTime - x.allTime),
                generatedAt: now.toISOString(),
            },
        }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not load the activity report") }
    }
}
