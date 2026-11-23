-- Settings hub (plan/main/settings/settings-hub.md): user.onboarded_at, notification_preference, user_setting.
-- Additive and idempotent - safe to run twice. On a FRESH database `ALLOW_DB_PUSH=1 pnpm db:push` creates these instead.

-- user.onboarded_at: added AND backfilled in one step, only when missing - people who signed up before onboarding
-- existed count as onboarded; without the backfill every existing account was sent to /welcome. Run twice: no change.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'onboarded_at'
    ) THEN
        ALTER TABLE "user" ADD COLUMN "onboarded_at" timestamp;
        UPDATE "user" SET "onboarded_at" = "created_at";
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "notification_preference" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "topic" text NOT NULL,
    "email" boolean DEFAULT true NOT NULL,
    "in_app" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preference_user_topic_uq"
    ON "notification_preference" ("user_id", "topic");

CREATE TABLE IF NOT EXISTS "user_setting" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "key" text NOT NULL,
    "value" jsonb,
    "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_setting_user_key_uq" ON "user_setting" ("user_id", "key");
CREATE INDEX IF NOT EXISTS "user_setting_user_idx" ON "user_setting" ("user_id");
