-- Notes module (plan/main/notes/notes-module.md): pinned, tags, archived_at, updated_at on "note".
-- Additive and idempotent - safe to run twice. On a FRESH database `ALLOW_DB_PUSH=1 pnpm db:push` creates these instead.

ALTER TABLE "note" ADD COLUMN IF NOT EXISTS "pinned" boolean DEFAULT false NOT NULL;
ALTER TABLE "note" ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "note" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
-- updated_at: added and backfilled from created_at in ONE step, only when it is missing - otherwise every old note
-- would read "edited today", and a second run must not undo real edits.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_name = 'note' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE "note" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
        UPDATE "note" SET "updated_at" = "created_at";
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "notes_user_updated_idx" ON "note" ("user_id", "updated_at");
