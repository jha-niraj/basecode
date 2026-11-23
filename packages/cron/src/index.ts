/**
 * @repo/cron - scheduled jobs behind ONE dispatcher route, `/api/cron/[job]`, with a run log (`cron_run`).
 *
 * How it fits together
 * - wrangler `triggers.crons` (production only; staging has none) wakes `apps/main/worker.ts`, which POSTs
 *   `/api/cron/hourly` or `/api/cron/daily` with `Authorization: Bearer ${CRON_SECRET}`.
 * - The route checks `authorizeCronRequest`, then `runCronSlot(slot, JOBS)` runs that slot's jobs one after another,
 *   opens a `cron_run` row before each and closes it after, and returns a JSON summary. A job name instead of a slot
 *   (`/api/cron/delete-expired-verifications`) runs just that job - handy for a manual curl.
 *
 * Adding a job
 *   export const sendDigest = defineCronJob({ name: 'send-digest', slot: 'daily', description: '...',
 *       async run({ now }) { ...; return { sent: 12 } } })
 *   // apps/main/app/api/cron/[job]/route.ts: const JOBS = [...BUILT_IN_JOBS, sendDigest]
 * A new schedule = a new slot here + a `triggers.crons` entry + a line in worker.ts `CRON_JOBS`.
 *
 * Jobs stay short (bounded batches, seconds). Anything that can run for minutes is a Workflow the job only starts.
 */
export {
    CRON_SLOTS, isCronSlot, defineCronJob, BUILT_IN_JOBS, deleteExpiredVerifications, pruneCronRuns,
    type CronSlot, type CronJob, type CronJobContext, type CronJobResult,
} from './jobs'
export {
    authorizeCronRequest, runCronSlot, latestCronRuns, type CronJobOutcome, type CronSlotSummary,
} from './runner'
