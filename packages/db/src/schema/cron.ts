// cron tables - @repo/cron. Exported from index.ts.
//
// cron_run: one row per job per wake-up (what ran, when, how long, ok or not, a small JSON summary). The admin system
// page and a "last ran" check read it. Old rows are pruned by the built-in `prune-cron-runs` job.
import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const CRON_RUN_STATUSES = ['running', 'ok', 'failed', 'skipped'] as const
export type CronRunStatus = (typeof CRON_RUN_STATUSES)[number]

export const cronRun = pgTable(
    'cron_run',
    {
        id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
        /** The registered job name (`delete-expired-verifications`). */
        job: text('job').notNull(),
        /** The slot that woke it (`hourly`, `daily`, or `manual`). */
        slot: text('slot').notNull(),
        status: text('status').$type<CronRunStatus>().notNull().default('running'),
        startedAt: timestamp('started_at').notNull().defaultNow(),
        finishedAt: timestamp('finished_at'),
        durationMs: integer('duration_ms'),
        /** What the job reported (`{ deleted: 12 }`). Never secrets or personal data. */
        result: jsonb('result').$type<unknown>(),
        error: text('error'),
    },
    (t) => [
        index('cron_run_job_started_idx').on(t.job, t.startedAt),
        index('cron_run_started_idx').on(t.startedAt),
    ],
)
