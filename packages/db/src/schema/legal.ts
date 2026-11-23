// legal tables - @repo/legal. Exported from index.ts.
//
// legal_acceptance: who accepted which version of which document, when (and from where). Append-only: a new version
// is a new row; the unique index makes re-accepting the same version a no-op.
import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './core'

export const legalAcceptance = pgTable(
    'legal_acceptance',
    {
        id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
        /** Document slug: `terms`, `privacy`. */
        document: text('document').notNull(),
        /** The document's version string (`2026-11-23`). */
        version: text('version').notNull(),
        acceptedAt: timestamp('accepted_at').notNull().defaultNow(),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
    },
    (t) => [
        uniqueIndex('legal_acceptance_user_doc_version_uq').on(t.userId, t.document, t.version),
        index('legal_acceptance_user_idx').on(t.userId),
    ],
)
