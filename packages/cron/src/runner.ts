// @repo/cron - authorising a cron request and running a slot's jobs one after another, each recorded in cron_run.
import { safeEqual } from '@repo/crypto/password'
import { db, desc, eq } from '@repo/db'
import { cronRun } from '@repo/db/schema'
import type { CronJob, CronJobContext, CronJobResult, CronSlot } from './jobs'

/**
 * True when the request carries `Authorization: Bearer <CRON_SECRET>` (constant-time compare). False - never a throw -
 * when CRON_SECRET is unset or blank, so an unconfigured app refuses every call instead of accepting an empty token.
 */
export function authorizeCronRequest(request: Request): boolean {
    const secret = process.env.CRON_SECRET?.trim()
    if (!secret) return false
    const header = request.headers.get('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    return token.length > 0 && safeEqual(token, secret)
}

export interface CronJobOutcome {
    job: string
    status: 'ok' | 'failed'
    durationMs: number
    result?: CronJobResult
    /** A short message; the full error is in the server log. */
    error?: string
}

export interface CronSlotSummary {
    slot: CronSlot | 'manual'
    startedAt: string
    durationMs: number
    ok: number
    failed: number
    jobs: CronJobOutcome[]
}

/** Recording never breaks the job: a failed log write costs a row, a thrown recorder would cost the work. */
async function quietly<T>(label: string, op: () => Promise<T>): Promise<T | null> {
    try {
        return await op()
    } catch (err) {
        console.error(`[cron] ${label} failed:`, err)
        return null
    }
}

async function runOne(job: CronJob, ctx: CronJobContext): Promise<CronJobOutcome> {
    const started = Date.now()
    // Open the row FIRST: a job killed mid-flight leaves a `running` row instead of no trace at all.
    const opened = await quietly('open run row', () =>
        db.insert(cronRun).values({ job: job.name, slot: ctx.slot, status: 'running', startedAt: new Date(started) }).returning({ id: cronRun.id }),
    )
    const runId = opened?.[0]?.id ?? null
    let outcome: CronJobOutcome
    try {
        const result = (await job.run(ctx)) ?? {}
        outcome = { job: job.name, status: 'ok', durationMs: Date.now() - started, result }
    } catch (err) {
        console.error(`[cron] ${job.name} failed:`, err)
        const message = err instanceof Error ? err.message : String(err)
        outcome = { job: job.name, status: 'failed', durationMs: Date.now() - started, error: message.slice(0, 300) }
    }
    if (runId) {
        await quietly('close run row', () =>
            db.update(cronRun).set({
                status: outcome.status,
                finishedAt: new Date(),
                durationMs: outcome.durationMs,
                result: outcome.result ?? null,
                error: outcome.error ?? null,
            }).where(eq(cronRun.id, runId)),
        )
    }
    return outcome
}

/**
 * Run every job registered for `slot`, ONE AFTER ANOTHER (they share one database compute window, and one failure
 * never stops the rest). Never throws. `only` runs a single job by name (a manual run).
 */
export async function runCronSlot(
    slot: CronSlot,
    jobs: readonly CronJob[],
    opts: { only?: string } = {},
): Promise<CronSlotSummary> {
    const now = new Date()
    const selected = opts.only ? jobs.filter((j) => j.name === opts.only) : jobs.filter((j) => j.slot === slot)
    const ctx: CronJobContext = { now, slot: opts.only ? 'manual' : slot }
    const outcomes: CronJobOutcome[] = []
    for (const job of selected) outcomes.push(await runOne(job, ctx))
    return {
        slot: ctx.slot,
        startedAt: now.toISOString(),
        durationMs: Date.now() - now.getTime(),
        ok: outcomes.filter((o) => o.status === 'ok').length,
        failed: outcomes.filter((o) => o.status === 'failed').length,
        jobs: outcomes,
    }
}

/** The latest run of each job (for an admin "system" page). */
export async function latestCronRuns(limit = 50): Promise<Array<typeof cronRun.$inferSelect>> {
    return db.select().from(cronRun).orderBy(desc(cronRun.startedAt)).limit(limit)
}
