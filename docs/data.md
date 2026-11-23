# Data - tables, client, schema changes, seed

Rules: [`AGENTS.md` section 6](../AGENTS.md#6-database). Schema: one file per area in `packages/db/src/schema/`,
re-exported by `schema/index.ts` (`core ai billing cron legal erasure payments settings notes`). Import tables from
`@repo/db/schema`, operators (`eq`, `and`, `sql`, `count` ...) from `@repo/db`.

## The client (`packages/db/src/client.ts`)

- `drizzle-orm/neon-http` over `@neondatabase/serverless` `neon()` - HTTP, because Workers have no raw TCP.
- Exports: `db` (typed, with `schema` for `db.query.*`), `neonQuery` (raw tagged-template client), `createDb(url)`,
  `schema`, type `Database` (`DB` is a deprecated alias).
- `neonConfig.fetchFunction = retryingFetch`: up to 3 attempts, 4s timeout each, backoff 250ms / 500ms. Retries only
  when the server never answered (`isTransient` from `@repo/errors`) or Neon answered 429 / 5xx with
  `"neon:retryable": true` (or a non-JSON 5xx). A 402 is never retried; it calls `noteQuotaExhausted()` so
  `classifyError` can say "quota".
- `db.batch([...])` is one round trip (used by the AI chat route, `lib/dashboard.ts`, `userPeekFor`).
  **`db.transaction()` throws** on neon-http; better-auth runs with `transaction: false`.
- No `DATABASE_URL` = a warning and a placeholder connection string; calls fail at runtime.

## Tables

### Auth (`schema/core.ts`, better-auth's four)

| Table | Purpose | Key columns | Owner | Indexes |
|---|---|---|---|---|
| `user` | A person | `id`, `name`, `email` (unique), `email_verified`, `image` (R2 key or URL), `role` enum `role` (`USER`, `ADMIN`), `is_active`, `bio`, `address`, `onboarded_at` (null -> `/welcome`) | `@repo/auth` | unique `email` |
| `session` | A signed-in device | `token` (unique), `expires_at`, `ip_address`, `user_agent`, `user_id` -> user cascade | `@repo/auth` | unique `token` |
| `account` | A sign-in method | `provider_id` (`credential`, `google`), `account_id`, `password` (scrypt), OAuth tokens, `user_id` cascade | `@repo/auth` | none |
| `verification` | Email links and codes | `identifier`, `value`, `expires_at` | `@repo/auth`; pruned daily by `delete-expired-verifications` | none |

### Admin console (`schema/core.ts`)

| Table | Purpose | Key columns | Owner | Indexes |
|---|---|---|---|---|
| `admin_access` | Who is an admin and what they hold | `user_id` (unique, cascade), `admin_role` enum (`SUPER_ADMIN`, `TEAM_MEMBER`), `status` enum (`ACTIVE`, `INACTIVE`, `SUSPENDED`), `permissions` json `{ module: level[] }`, `last_login_at`, `login_count`, legacy `hashed_password` / `access_code*` | `apps/admin` | role, status, user_id |
| `admin_invitation` | Pending invites | `code` (unique, the `/join?token=`), `email`, `admin_role`, `permissions`, `status` enum (`PENDING`, `USED`, `EXPIRED`, `REVOKED`), `expires_at`, `created_by_id` -> admin_access | `apps/admin` | code, email, status, expires_at, created_by_id |
| `admin_audit_log` | Every admin change | `admin_id` -> admin_access cascade, `action`, `module`, `resource_type`, `resource_id`, `description`, `changes`, `metadata`, `ip_address`, `user_agent` | `apps/admin` | admin_id, module, action, created_at, (resource_type, resource_id) |
| `admin_notification` | The admin bell | `admin_id` (nullable = everyone), `title`, `message`, `type`, `action_url`, `is_read`, `read_at` | `apps/admin` | admin_id, is_read, created_at |
| `admin_system_settings` | Key / value platform settings | `key` (unique), `value` json, `last_modified_by` | `apps/admin` `/system/settings` | key |
| `admin_dashboard_stats` | Cached stat blobs | `stat_type` (unique), `data` | not read or written by any app today | stat_type, last_updated_at |
| `announcement` | Platform announcements | `title`, `content`, `status` enum (`DRAFT`, `PUBLISHED`, `ARCHIVED`), `priority`, `author_id` -> admin_access, `published_at`, `expires_at` | `apps/admin` (main does not display them yet) | status, author_id, created_at |
| `broadcast` | Email broadcasts | `subject`, `content`, `status` enum (`DRAFT`, `SENT`, `SCHEDULED`, `FAILED`), `recipient_type`, `recipient_count`, `sent_count`, `author_id`, `scheduled_at`, `sent_at` | `apps/admin` | status, author_id, created_at |

### Product (main)

| Table | File | Purpose | Key columns | Indexes |
|---|---|---|---|---|
| `notification` | `core.ts` | A person's inbox | `user_id` cascade, `title`, `message`, `type` enum (`info`, `success`, `warning`, `error`), `is_read`, `read_at`, `action_url`, `action_label`, `metadata` (carries `topic`) | user_id, is_read, created_at |
| `note` | `notes.ts` | Notes (reference module + AI tools) | `user_id` cascade, `title`, `body`, `pinned`, `tags text[]`, `archived_at` (null = active), `created_at`, `updated_at` | (user_id, created_at), (user_id, updated_at) |
| `notification_preference` | `settings.ts` | Per (person, topic) email / in-app switch; no row = both on | `user_id`, `topic`, `email`, `in_app` | unique (user_id, topic) |
| `user_setting` | `settings.ts` | Per-person key / value (`appearance.density`, `appearance.reducedMotion`, `onboarding.useFor`; keys in `SETTING_KEYS`, `apps/main/lib/settings-values.ts`) | `user_id`, `key`, `value` jsonb | unique (user_id, key), user_id |
| `ai_conversation` | `ai.ts` | One chat | `user_id` cascade, `title`, `updated_at` | (user_id, updated_at) |
| `ai_message` | `ai.ts` | One message | `conversation_id` cascade, `user_id`, `role` (`user`/`assistant`), `content` (what the model reads), `display` (bubble text), `context` (per-turn block, replayed), `parts` jsonb (view parts), `model_messages` jsonb (provider messages, replayed byte for byte) | (conversation_id, created_at), user_id |
| `ai_usage_log` | `billing.ts` | One row per model call, priced | `user_id` (set null on delete), `feature`, `task`, `model`, `conversation_id`, `steps`, `input_tokens`, `cache_read_tokens`, `cache_write_5m_tokens`, `cache_write_1h_tokens`, `output_tokens`, `cost_micro_usd` (integer millionths of a dollar), `price_known`, `failed`, `requests` jsonb | (user_id, created_at), created_at |

### Platform packages

| Table | File | Owner | Purpose | Indexes |
|---|---|---|---|---|
| `cron_run` | `cron.ts` | `@repo/cron` | One row per job per wake-up: `job`, `slot` (`hourly`/`daily`/`manual`), `status` (`running ok failed skipped`), `duration_ms`, `result`, `error`; pruned to 30 days by `prune-cron-runs` | (job, started_at), started_at |
| `legal_acceptance` | `legal.ts` | `@repo/legal` | Who accepted which `document` + `version`, append-only | unique (user_id, document, version), user_id |
| `erasure_request` | `erasure.ts` | `@repo/erasure` | Record of an erased account: `user_id` (no FK), `email_hash` (SHA-256), `requested_by`, `status`, `counts` | user_id, requested_at |

### Billing and payments

`billing_account`, `subscription`, `payment`, `credit_ledger` (`billing.ts`) and `payment_customer`, `payment_event`,
`payment_provider_plan` (`payments.ts`) belong to the payments work - see [`payments.md`](payments.md).

## Changing the schema

**Fresh database** (nothing in it that matters): edit the schema file, then

```bash
ALLOW_DB_PUSH=1 pnpm db:push
```

`db:push` runs `scripts/guard-push.mjs` first (refuses without `ALLOW_DB_PUSH=1`), then `drizzle-kit push` with
`dotenv -e ../../apps/main/.env.local`. Push applies every difference it finds, drops included.

**A database with data**: edit the schema file AND write an additive, idempotent SQL file in `packages/db/scripts/`
(`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DO $$ ... $$` for a one-time
backfill - see `scripts/notes-columns.sql`). Then preview, apply, and apply again (the second run must change nothing):

```bash
pnpm --filter @repo/db sql scripts/<file>.sql            # preview: prints "Target database: <host label>" and each statement
pnpm --filter @repo/db sql scripts/<file>.sql --apply    # run it
pnpm --filter @repo/db sql scripts/<file>.sql --apply    # run it twice
```

`scripts/run-sql.mjs` splits on `;` outside quotes and `$$` blocks (Neon HTTP takes one statement per request) and
reads `DATABASE_URL` from `apps/main/.env.local` (the staging database). Production schema changes are run by the owner
([AGENTS.md section 4](../AGENTS.md#4-environments---read-before-touching-env-files-wrangler-or-a-database)).

Existing scripts: `notes-columns.sql`, `settings-tables.sql`, `billing-2026-11-23.sql`,
`2026-11-23-user-onboarded-at.mjs` (a `.mjs` script with its own `--apply`; run with
`pnpm --filter @repo/db exec dotenv -e ../../apps/main/.env.local -- node scripts/2026-11-23-user-onboarded-at.mjs`).
Note `settings-tables.sql` also adds `user.onboarded_at` but without the backfill the `.mjs` does; on an existing
database run the `.mjs` first, or existing people are all sent to `/welcome`.

Other commands: `pnpm db:studio` (drizzle-kit studio). `drizzle.config.ts` points at `src/schema/index.ts`.

## Seed (`packages/db/src/seed.ts`, `pnpm db:seed`)

Idempotent. Creates one super admin when `SEED_ADMIN_EMAIL` (default `superadmin@example.com`) does not exist yet: a
`user` row (`id` `seed-superadmin-001`, `role: 'ADMIN'`, verified), a `credential` `account` with a scrypt hash, and an
`admin_access` row (`SUPER_ADMIN`, every module). Password: `SEED_ADMIN_PASSWORD`, else a random one printed once.
Reads `apps/main/.env.local`. Sign in at `http://localhost:3101/` (admin) or `http://localhost:3100/signin` (main).

## Conventions

- Every per-person row carries `user_id` and every query filters by it; writes also match it in the WHERE
  (`apps/main/actions/notes.action.ts`). Adding tenants later: [`workspaces.md`](workspaces.md).
- jsonb columns are `unknown` and narrowed by the reader (`apps/main/lib/ai/parts.ts` `asParts`).
- Money and cost are integers (`cost_micro_usd`; minor units in billing).
- A new per-user table goes into `ERASE_TABLES` or `DETACH_TABLES` in `packages/erasure/src/user.ts`
  (tables with `onDelete: 'cascade'` to `user` also go when the user row is deleted).
