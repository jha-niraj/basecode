// settings tables - apps/main's Settings hub. Exported from index.ts.
//
// notification_preference: one row per (person, topic) once they change it; no row = the topic's default (both on).
// user_setting: a per-person key/value store (appearance density, reduced motion, the onboarding "use for" answer) so a
// new preference never needs a column. Values are jsonb, read as `unknown` and narrowed by the reader.
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './core'

export const notificationPreference = pgTable(
    'notification_preference',
    {
        id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
        /** A topic key from NOTIFICATION_TOPICS in apps/main/lib/settings-values.ts (e.g. `ai`, `billing`). */
        topic: text('topic').notNull(),
        email: boolean('email').notNull().default(true),
        inApp: boolean('in_app').notNull().default(true),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => [uniqueIndex('notification_preference_user_topic_uq').on(t.userId, t.topic)],
)

export const userSetting = pgTable(
    'user_setting',
    {
        id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
        key: text('key').notNull(),
        value: jsonb('value'),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex('user_setting_user_key_uq').on(t.userId, t.key),
        index('user_setting_user_idx').on(t.userId),
    ],
)
