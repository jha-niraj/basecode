import { and, eq, gte, sql, type Database } from '@repo/db'
import { aiUsageLogs } from '@repo/db/schema'
import type { AiUsageRecord } from '@repo/ai'
import { priceCall } from './ai-meter'

/** Write one `ai_usage_log` row for a model call, priced by the meter. */
export async function logAiUsage(db: Database, record: AiUsageRecord): Promise<void> {
    const cost = priceCall(record.model, record.requests)
    await db.insert(aiUsageLogs).values({
        userId: record.userId,
        feature: record.feature,
        task: record.task,
        model: record.model,
        conversationId: record.conversationId ?? null,
        steps: record.requests.length,
        ...cost.totals,
        costMicroUsd: cost.microUsd,
        priceKnown: cost.priceKnown,
        failed: record.failed ?? false,
        requests: record.requests,
    })
}

/** Start of the current UTC day - the cap's window. */
export function startOfUtcDay(at: Date = new Date()): Date {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
}

/** What a person's AI calls cost today (UTC), in millionths of a dollar. */
export async function spentTodayMicroUsd(db: Database, userId: string): Promise<number> {
    const [row] = await db
        .select({ total: sql<string | null>`sum(${aiUsageLogs.costMicroUsd})` })
        .from(aiUsageLogs)
        .where(and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, startOfUtcDay())))
    return Number(row?.total ?? 0)
}

/** The per-person daily cap from `AI_DAILY_USD_CAP_PER_USER` in millionths of a dollar; null = off (blank or unset). */
export function dailyCapMicroUsd(): number | null {
    const raw = process.env.AI_DAILY_USD_CAP_PER_USER?.trim()
    if (!raw) return null
    const usd = Number(raw)
    if (!Number.isFinite(usd) || usd <= 0) {
        console.warn('[billing] AI_DAILY_USD_CAP_PER_USER is not a positive number - the cap is off')
        return null
    }
    return Math.round(usd * 1e6)
}

/** Whether the person may start another AI call today. */
export async function checkDailyCap(db: Database, userId: string): Promise<{ ok: boolean; spentMicroUsd: number; capMicroUsd: number | null }> {
    const cap = dailyCapMicroUsd()
    if (cap === null) return { ok: true, spentMicroUsd: 0, capMicroUsd: null }
    const spent = await spentTodayMicroUsd(db, userId)
    return { ok: spent < cap, spentMicroUsd: spent, capMicroUsd: cap }
}
