# Basecode

A starter monorepo you clone to begin a new product with the boring parts already right: sign-in (password, Google,
email code), a full-page AI workspace with a right column and a cost-tuned Claude setup, Settings, Notes as the
reference module, billing with five payment providers, an admin console, and the rules that keep it all consistent.

**Working on this with Claude Code (or any agent)? Start at [`docs/README.md`](docs/README.md)** - the map - and
[`AGENTS.md`](AGENTS.md) - the rules. `CLAUDE.md` is one line that imports AGENTS.md.

## Stack

Next 16 (webpack) + React 19 + Tailwind 4 on Cloudflare Workers (OpenNext), Neon Postgres over HTTP with Drizzle,
better-auth, AI SDK 7 with Claude (Haiku 5.5 for everyday work), pnpm + Turborepo, TypeScript 5.9.

| App | What | Port |
|---|---|---|
| `apps/main` | The product. Signed-in people land on `/ai` | 3100 |
| `apps/admin` | Admin console: team, access, users, billing, audit, system | 3101 |

Packages (`packages/*`, imported as `@repo/<name>`): `ui`, `core`, `errors`, `db`, `auth`, `crypto`, `email`, `storage`,
`ai`, `billing`, `payments`, `sarvamai`, `pdf`, `cron`, `legal`, `erasure`, `webdata`, `calendar`, plus the eslint and
typescript configs. What each owns: [`docs/architecture.md`](docs/architecture.md).

## First run

```bash
pnpm install

# 1. Env: every app has .env.local (your machine), .env (staging), .env.production (production).
#    Put DATABASE_URL and ANTHROPIC_API_KEY into apps/main/.env.local and apps/admin/.env.local (same database).
#    Blank keys turn features off; __LIKE_THIS__ must be filled before a deploy.
pnpm env:check

# 2. Database: a FRESH Neon database only - after that, additive SQL scripts (AGENTS.md section 6)
ALLOW_DB_PUSH=1 pnpm db:push
pnpm db:seed                      # super admin; password from SEED_ADMIN_PASSWORD or printed once

# 3. Run one app at a time
pnpm --filter main dev            # http://localhost:3100
pnpm --filter admin dev           # http://localhost:3101
```

Without `RESEND_API_KEY`, every email (verify link, sign-in code, reset link, invitation) is printed to the dev server
console instead of sent, so every auth flow works locally.

## Making it yours

Rename the product, ports, Worker names and cookies with the checklist in
[`docs/recipes.md`](docs/recipes.md#rename-the-product). The brand lives in one place: `packages/core/src/site.ts`.

## Deploying

`pnpm deploy:staging <main|admin|all>` and `pnpm deploy:prod <main|admin|all>` - they refuse to run until the
Cloudflare account id, URLs and production database are set. What to set up first:
[`docs/env-and-deploy.md`](docs/env-and-deploy.md).

## Where things stand

`plan/INDEX.md` lists every piece of work and its state. Workspaces (teams) are not built yet - the plan for them is
[`docs/workspaces.md`](docs/workspaces.md).
