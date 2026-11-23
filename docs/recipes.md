# Recipes

Step-by-step checklists with the exact files. Every recipe starts with a plan doc (`plan/<app>/<module>/<slug>.md` from
`plan/TEMPLATE.md`, a row in `plan/INDEX.md`) and ends with one scoped typecheck (AGENTS.md section 1).

## Add a module (copy Notes)

The reference is Notes: `apps/main/app/(main)/notes/`, `actions/notes.action.ts`, `lib/notes.ts`, `schemas/notes.ts`,
`types/notes.ts`, `packages/db/src/schema/notes.ts`.
1. **Table**: `packages/db/src/schema/<module>.ts` (owner column `userId` + composite index leading with it), export it
   from `schema/index.ts`; create it (see "Add a table" below); add it to `ERASE_TABLES` in
   `packages/erasure/src/user.ts`.
2. **Types** `apps/main/types/<module>.ts` (plain data, ISO strings; re-export from `types/index.ts`) and **schemas**
   `apps/main/schemas/<module>.ts` (zod; never inside a `'use server'` file).
3. **Reads** `apps/main/lib/<module>.ts` with `import 'server-only'`, every query filtered by the user id; shared by
   actions, the page and any PDF.
4. **Actions** `apps/main/actions/<module>.action.ts` (`'use server'`, async exports only): `requireSession()`, parse
   with the schema, return `ok(...)` / `fail(e)`; writes match the user id in the WHERE.
5. **Route** `app/(main)/<module>/page.tsx` (session check, parse the URL with the module's query module, start all reads
   at once, pass `initial*`), `loading.tsx` rendering the module skeleton, `_components/<module>-client.tsx`
   (`Page`, `StatBand`, list in a bounded ScrollArea / DataGrid, `useQuery` with `initialData` under the same key,
   `keepPreviousData`, `history.replaceState` for URL state), `<module>-query.ts` (keys `["<module>", ...]`, URL parser
   - a plain module, no `"use client"`), `<module>-sheet.tsx` (keep-open sheet, rows carry `data-sheet-keep-open`),
   `use-<module>-mutations.ts` (invalidate the module key), `<module>-skeleton.tsx` (title / description constants shared
   with the client).
6. **Nav**: route constant in `ROUTES` and an item in `MAIN_NAV` (`apps/main/lib/navigation.ts`; `tab: true` for the
   phone bar, four at most). URL without hyphens.
7. **AI** (optional): a read tool and a link (see "Add an AI tool").

## Add a table or column

- **Fresh database**: edit the schema file, `ALLOW_DB_PUSH=1 pnpm db:push`.
- **Database with data**: edit the schema file AND write `packages/db/scripts/<date>-<what>.sql` (additive,
  `IF NOT EXISTS`, `DO $$` for a guarded backfill), then
  `pnpm --filter @repo/db sql scripts/<file>.sql` (preview), `... --apply`, and `--apply` again. Staging only; hand the
  script to the owner for production. Details: [`data.md`](data.md).

## Add a settings section

1. Route constant in `apps/main/lib/navigation.ts` (`ROUTES.settings<Name>`).
2. An entry in `SETTINGS_SECTIONS` (`app/(main)/settings/_components/settings-nav.tsx`) - the rail and the phone Select
   both read it.
3. `app/(main)/settings/<name>/page.tsx` (session check, read, `<Page width="reading">` in the view), `loading.tsx` with
   `PageSkeleton width="reading"` + the same title / description, a skeleton in `_components/settings-skeletons.tsx`.
4. Per-person values: a key in `SETTING_KEYS` (`lib/settings-values.ts`) stored in `user_setting` (no new column), the
   read in `lib/settings.ts`, the write in `actions/settings.action.ts`.

## Add an AI tool / a peek kind / a Needs-you source

See [`ai.md`](ai.md): "Add a tool", "Add a peek kind", "Needs you".

## Add an email template

1. A function in `packages/email/src/templates.ts` returning `EmailContent` (`{ subject, html, text }`), built with
   `layout`, `heading`, `paragraph`, `button`, `fallbackLink`, `codeBlock` and `esc` / `escUrl` from `layout.ts`; write
   the plain text by hand.
2. Export it from `packages/email/src/index.ts`.
3. Send: `await sendEmail({ kind: 'transactional', to, ...myEmail(...) })` (marketing needs `unsubscribeUrl`). Inline when
   the person waits for it; `after()` when best effort. Check `result.status` (`sent | skipped | failed`).

## Add a cron job

1. `defineCronJob({ name: 'kebab-name', slot: 'hourly' | 'daily', description, async run({ now }) { ...; return { n } } })`
   - in `packages/cron/src/jobs.ts` for a platform job (add to `BUILT_IN_JOBS`), or next to its package.
2. Add it to `JOBS` in `apps/main/app/api/cron/[job]/route.ts`.
3. A new schedule: a slot in `CRON_SLOTS` (`packages/cron/src/jobs.ts`), the expression in `CRON_JOBS`
   (`apps/main/worker.ts`) and in `env.prod.triggers.crons` (`apps/main/wrangler.jsonc`; staging stays `[]`).
4. Test: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3100/api/cron/<name>`; the run is in
   `cron_run`. Minutes-long work belongs in a Workflow the job only starts.

## Add an admin page with a permission

1. New module? Add it to `AdminPermission` and `ADMIN_MODULES` (`apps/admin/lib/permissions.ts`) and to the
   `SUPER_ADMIN` defaults; the permission matrix (`admins/_components/permission-matrix.tsx`) reads `ADMIN_MODULES`.
2. Route constant in `ROUTES` and an item with `permission` in `NAV` (`apps/admin/lib/navigation.ts`).
3. `app/(main)/<path>/page.tsx`: `await requireAdminPage('<module>')` first; `loading.tsx` with `PageSkeleton`; client in
   `_components/`, write buttons gated with `adminCan(useAdminAccess(), module, 'write')`.
4. Actions in `apps/admin/actions/<area>.action.ts`: `const admin = await requireAdminAction('<module>', '<level>')`,
   write an `admin_audit_log` row for every change. Never import a big action file from the layout.

## Add a notification topic

1. An entry in `NOTIFICATION_TOPICS` (`apps/main/lib/settings-values.ts`; `emailLocked: true` for security notices).
   `/settings/notifications` lists it automatically.
2. Notify from server code: `createNotification({ userId, title, message, topic, actionUrl })` (`lib/notifications.ts`,
   server-only - never a `'use server'` export). Email: check `wantsNotification(userId, topic, 'email')`
   (`lib/settings.ts`) before `sendEmail`.

## Add a PDF document

1. A case in `DOCUMENTS` in `apps/main/app/api/documents/[...path]/route.ts`: load rows filtered by the session's user,
   `renderDataTablePdf({ title, columns, rows, meta, note })` (strings only), return
   `pdfResponse(bytes, pdfFilename({ type }), { download })`.
2. Reuse the page's own param parser and `lib/<module>.ts` read so the file matches the screen (`notes.pdf`).
3. Non-Latin text or currency symbols: `setPdfFontSource(fontSourceFromUrls(...))` once. Open the file and look at it.

## Rename the product

1. `SITE` in `packages/core/src/site.ts` (name, tagline, description). Titles, metadata, landing, auth frame, emails and
   status screens read it.
2. Workers: `name`, `env.prod.name`, both `services` entries, bucket names in `apps/*/wrangler.jsonc`.
3. Package names: root `package.json` `"name": "basecode"`; app names `main` / `admin` are used by `--filter` and the
   deploy scripts - rename only together with `scripts/env-files.mts` and `scripts/deploy.mts`.
4. Cookie prefixes: `env.AUTH_COOKIE_PREFIX` in `apps/*/next.config.js`; rail cookies `MAIN_RAIL_COOKIE`,
   `ADMIN_RAIL_COOKIE`; localStorage keys `app.ai.column-open` / `app.ai.column-width` in `components/ai/`.
5. Fonts: `apps/*/app/fonts.ts` (`next/font/local`, woff2 files committed next to it).
6. Legal: `LEGAL_CONTEXT` in `apps/main/app/(legal)/_components/legal-document.tsx`, text in
   `packages/legal/src/documents.ts` (`template: false` once reviewed). Landing: `apps/main/app/page.tsx`. Manifest icons:
   `apps/main/app/manifest.ts`.

## Add a third app

1. `apps/<name>/` with its own port (next free one in the 3100 block) in `package.json` `dev` (`next dev --webpack
   --port 31xx`) and in its `.env.local` URLs; copy `next.config.js` (new `AUTH_COOKIE_PREFIX`), `middleware.ts`,
   `worker.ts`, `open-next.config.ts`, `wrangler.jsonc` (new names), `app/providers.tsx`, `app/fonts.ts`,
   `postcss.config.mjs`, `tsconfig.json`, `eslint.config.js`.
2. Three env files; add the app to `APPS_WITH_ENV` (`scripts/env-files.mts`) and `APPS` (`scripts/deploy.mts`, in
   deploy order).
3. Auth: its origin in trusted origins - the env URL keys, and the dev ports list in `trustedOrigins()`
   (`packages/auth/src/server.ts`).
4. Tailwind: the app imports `@repo/ui/styles/globals.css`, which already scans `packages/ui` and `packages/auth`
   (`@source` lines). A NEW package that ships UI needs its own `@source` line there.
5. A plan folder `plan/<name>/` and a row in AGENTS.md section 2's app table; `apps/<name>/CLAUDE.md` for its rules.
