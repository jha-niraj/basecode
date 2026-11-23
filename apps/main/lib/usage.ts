import "server-only"

import { and, db, desc, eq, gte, sql } from "@repo/db"
import { aiUsageLogs } from "@repo/db/schema"
import { lastUtcDays } from "./format"

/**
 * The signed-in person's AI usage from ai_usage_log (cost is integer micro-USD). Days are UTC days, the same days the
 * daily cap in @repo/billing counts. Explicit windows (AGENTS.md section 9): today, last 7, last 30, this month.
 */
export interface UsageBucket {
    calls: number
    requests: number
    costMicroUsd: number
}

export interface UsageCall {
    id: string
    feature: string
    model: string
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    costMicroUsd: number
    priceKnown: boolean
    failed: boolean
    createdAt: string
}

export interface AiUsageData {
    today: UsageBucket
    last7: UsageBucket
    last30: UsageBucket
    thisMonth: UsageBucket
    /** Oldest first, one entry per UTC day of the last 30, a day with no calls is `null` (not recorded, not $0). */
    daily: { day: string; costMicroUsd: number | null }[]
    recent: UsageCall[]
    /** Any call in the window was for a model with no known price (its cost shows as 0). */
    unknownPrices: boolean
}

const RECENT_LIMIT = 50

function bucket(when: string) {
    const after = sql`${aiUsageLogs.createdAt} >= ${when}::timestamp`
    return {
        calls: sql<number>`count(*) filter (where ${after})`.mapWith(Number),
        requests: sql<number>`coalesce(sum(${aiUsageLogs.steps}) filter (where ${after}), 0)`.mapWith(Number),
        cost: sql<number>`coalesce(sum(${aiUsageLogs.costMicroUsd}) filter (where ${after}), 0)`.mapWith(Number),
    }
}

export async function getAiUsage(userId: string, now: Date = new Date()): Promise<AiUsageData> {
    const days = lastUtcDays(30, now)
    const today = days[days.length - 1]!
    const since7 = days[days.length - 7]!
    const since30 = days[0]!
    const monthStart = `${today.slice(0, 7)}-01`
    // The month can start before the 30-day window (on the 31st); scan from whichever is earlier.
    const scanFrom = monthStart < since30 ? monthStart : since30

    const t = bucket(today), w7 = bucket(since7), w30 = bucket(since30), m = bucket(monthStart)
    const mine = and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, new Date(`${scanFrom}T00:00:00Z`)))
    const dayExpr = sql<string>`to_char(date_trunc('day', ${aiUsageLogs.createdAt}), 'YYYY-MM-DD')`

    const [totals, perDay, recent] = await db.batch([
        db.select({
            tCalls: t.calls, tReq: t.requests, tCost: t.cost,
            w7Calls: w7.calls, w7Req: w7.requests, w7Cost: w7.cost,
            w30Calls: w30.calls, w30Req: w30.requests, w30Cost: w30.cost,
            mCalls: m.calls, mReq: m.requests, mCost: m.cost,
            unknown: sql<number>`count(*) filter (where not ${aiUsageLogs.priceKnown})`.mapWith(Number),
        }).from(aiUsageLogs).where(mine),
        db.select({ day: dayExpr, cost: sql<number>`coalesce(sum(${aiUsageLogs.costMicroUsd}), 0)`.mapWith(Number) })
            .from(aiUsageLogs)
            .where(and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, new Date(`${since30}T00:00:00Z`))))
            .groupBy(dayExpr),
        db.select({
            id: aiUsageLogs.id, feature: aiUsageLogs.feature, model: aiUsageLogs.model,
            inputTokens: aiUsageLogs.inputTokens, outputTokens: aiUsageLogs.outputTokens,
            cacheReadTokens: aiUsageLogs.cacheReadTokens, costMicroUsd: aiUsageLogs.costMicroUsd,
            priceKnown: aiUsageLogs.priceKnown, failed: aiUsageLogs.failed, createdAt: aiUsageLogs.createdAt,
        }).from(aiUsageLogs).where(eq(aiUsageLogs.userId, userId)).orderBy(desc(aiUsageLogs.createdAt)).limit(RECENT_LIMIT),
    ])

    const r = totals[0]
    const byDay = new Map(perDay.map((d) => [d.day, d.cost]))
    return {
        today: { calls: r?.tCalls ?? 0, requests: r?.tReq ?? 0, costMicroUsd: r?.tCost ?? 0 },
        last7: { calls: r?.w7Calls ?? 0, requests: r?.w7Req ?? 0, costMicroUsd: r?.w7Cost ?? 0 },
        last30: { calls: r?.w30Calls ?? 0, requests: r?.w30Req ?? 0, costMicroUsd: r?.w30Cost ?? 0 },
        thisMonth: { calls: r?.mCalls ?? 0, requests: r?.mReq ?? 0, costMicroUsd: r?.mCost ?? 0 },
        daily: days.map((day) => ({ day, costMicroUsd: byDay.has(day) ? byDay.get(day)! : null })),
        recent: recent.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
        unknownPrices: (r?.unknown ?? 0) > 0,
    }
}
