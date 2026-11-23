// erasure tables - @repo/erasure. Exported from index.ts.
//
// erasure_request: the record that an account was erased - kept AFTER the user row is gone, so it holds no foreign
// key and no personal data beyond the erased id and a one-way hash of the email (to answer "was I deleted?").
import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const ERASURE_STATUSES = ['running', 'completed', 'failed'] as const
export type ErasureStatus = (typeof ERASURE_STATUSES)[number]

export const erasureRequest = pgTable(
    'erasure_request',
    {
        id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
        /** The erased user's id (no FK - the row outlives the user). */
        userId: text('user_id').notNull(),
        /** SHA-256 hex of the lowercased email. */
        emailHash: text('email_hash'),
        /** Who asked: the user themself (`self`) or an admin's user id. */
        requestedBy: text('requested_by').notNull().default('self'),
        status: text('status').$type<ErasureStatus>().notNull().default('running'),
        /** Rows deleted per table plus files removed: `{ session: 2, account: 1, files: 1 }`. */
        counts: jsonb('counts').$type<Record<string, number>>().notNull().default({}),
        error: text('error'),
        requestedAt: timestamp('requested_at').notNull().defaultNow(),
        completedAt: timestamp('completed_at'),
    },
    (t) => [index('erasure_request_user_idx').on(t.userId), index('erasure_request_requested_idx').on(t.requestedAt)],
)
