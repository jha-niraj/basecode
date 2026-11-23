// @repo/cron - job definitions and the built-in housekeeping jobs.
import { db, lt } from '@repo/db'
import { cronRun, verification } from '@repo/db/schema'

/** The schedules `apps/main/worker.ts` maps to routes (wrangler `triggers.crons`, UTC, production only). */
export const CRON_SLOTS = {
    hourly: '0 * * * *',
    daily: '30 0 * * *',
} as const
export type CronSlot = keyof typeof CRON_SLOTS

export function isCronSlot(value: string): value is CronSlot {
    return Object.prototype.hasOwnProperty.call(CRON_SLOTS, value)
}

/** A JSON summary of what a job did (`{ deleted: 12 }`). Never secrets or personal data - it is stored and returned. */
export type CronJobResult = Record<string, string | number | boolean | null>

export interface CronJobContext {
    /** When this wake-up started. Use it instead of `new Date()` so every job in the slot agrees on "now". */
    now: Date
    slot: CronSlot | 'manual'
}

export interface CronJob {
    /** Unique, kebab-case (`delete-expired-verifications`); also the manual-run URL `/api/cron/<name>`. */
    name: string
    slot: CronSlot
    description: string
    /**
     * Keep it short (a few seconds, bounded batches). A job that can run for minutes belongs in a Workflow: the cron
     * job only starts it. Return a small summary.
     */
    run: (ctx: CronJobContext) => Promise<CronJobResult | void>
}

/** Identity helper for typed job literals. */
export function defineCronJob(job: CronJob): CronJob {
    return job
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Sign-in codes, reset links and verify links better-auth left behind, a day after they expired. */
export const deleteExpiredVerifications = defineCronJob({
    name: 'delete-expired-verifications',
    slot: 'daily',
    description: 'Deletes verification rows (email codes, reset and verify links) that expired more than a day ago.',
    async run({ now }) {
        const rows = await db
            .delete(verification)
            .where(lt(verification.expiresAt, new Date(now.getTime() - DAY_MS)))
            .returning({ id: verification.id })
        return { deleted: rows.length }
    },
})

/** Keep the run log to 30 days. */
export const pruneCronRuns = defineCronJob({
    name: 'prune-cron-runs',
    slot: 'daily',
    description: 'Deletes cron_run rows older than 30 days.',
    async run({ now }) {
        const rows = await db
            .delete(cronRun)
            .where(lt(cronRun.startedAt, new Date(now.getTime() - 30 * DAY_MS)))
            .returning({ id: cronRun.id })
        return { deleted: rows.length }
    },
})

/** Jobs every app gets. Append your own in the route: `[...BUILT_IN_JOBS, myJob]`. */
export const BUILT_IN_JOBS: readonly CronJob[] = [deleteExpiredVerifications, pruneCronRuns]
