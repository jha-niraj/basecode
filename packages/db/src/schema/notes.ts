// Notes - the reference module's table (apps/main/app/(main)/notes). The AI page's example tools (`saveNote`,
// `listNotes`) write and read it too, so a note saved from a chat shows on /notes at once.
//
// Copying this for a new module: one file per area, every row carries its owner (`userId`, or the tenant id) and every
// query filters by it; the composite index leads with that owner so a list never scans other people's rows.
import { sql } from 'drizzle-orm'
import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './core'

export const notes = pgTable(
    'note',
    {
        id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
        title: text('title').notNull(),
        body: text('body').notNull().default(''),
        /** Pinned notes sort first in the list. */
        pinned: boolean('pinned').notNull().default(false),
        /** Free tags, lower-cased and de-duplicated by the action before they are written. */
        tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
        /** Set = archived (out of the Active tab, kept). Null = active. A timestamp, not a flag, so "archived on" shows. */
        archivedAt: timestamp('archived_at'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        /** Bumped by every edit (title, body, tags, pin, archive) - "Edited" in the band and the list's order. */
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => [
        index('notes_user_created_idx').on(t.userId, t.createdAt),
        index('notes_user_updated_idx').on(t.userId, t.updatedAt),
    ],
)

export type NoteRecord = typeof notes.$inferSelect
export type NewNoteRecord = typeof notes.$inferInsert
