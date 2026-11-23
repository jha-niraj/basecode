/**
 * The usage sink. The ai package owns NO table: the app registers a sink at startup (apps/main/lib/ai/usage-sink.ts)
 * that prices the call with @repo/billing and writes an `ai_usage_log` row. Every model call goes through
 * `recordAiUsage`, including a turn that failed after some steps ran (those steps were billed to us).
 */

/** One request to the provider (one step of a tool loop). Cache reads and writes are SUBSETS of `inputTokens`. */
export interface AiRequestUsage {
    inputTokens: number
    cacheReadTokens: number
    /** All cache writes (5-minute + 1-hour). */
    cacheWriteTokens: number
    /** The 1-hour part of `cacheWriteTokens`, priced at its own (2x input) rate. */
    cacheWrite1hTokens: number
    outputTokens: number
}

export interface AiUsageRecord {
    userId: string | null
    /** What the call was for, e.g. `ai_page_chat`. */
    feature: string
    task: string
    model: string
    conversationId?: string | null
    /** One entry per request, so the meter prices each at its own card (long context is per request). */
    requests: AiRequestUsage[]
    /** The turn produced no answer (failed). A failed turn is logged for our cost, never charged to a person. */
    failed?: boolean
}

export type AiUsageSink = (record: AiUsageRecord) => Promise<void>

let sink: AiUsageSink | null = null

export function setAiUsageSink(next: AiUsageSink): void {
    sink = next
}

/** Awaited by the caller - a usage row is something we are told happened, so it never floats. Never throws. */
export async function recordAiUsage(record: AiUsageRecord): Promise<void> {
    if (!record.requests.length) return
    if (!sink) {
        console.warn('[ai usage] no sink registered - usage not stored', { feature: record.feature, model: record.model })
        return
    }
    try {
        await sink(record)
    } catch (err) {
        console.error('[ai usage] sink failed', err instanceof Error ? err.message : err)
    }
}
