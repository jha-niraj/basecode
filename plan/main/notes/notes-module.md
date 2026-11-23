# Notes - the reference list module

| | |
|---|---|
| **App / module** | `main/notes` |
| **Status** | In progress |
| **Opened** | 2026-11-23 |
| **Last updated** | 2026-11-23 |
| **Files** | `packages/db/src/schema/notes.ts` (moved from `ai.ts`), `packages/db/src/schema/ai.ts`, `packages/db/src/schema/index.ts` (one line), `packages/db/scripts/notes-columns.sql`, `apps/main/actions/notes.action.ts`, `apps/main/lib/notes.ts` (server-only reads shared with the PDF), `apps/main/schemas/notes.ts`, `apps/main/types/notes.ts`, `apps/main/app/(main)/notes/**`, `apps/main/app/api/documents/[...path]/route.ts` (`notes.pdf`) |

## What was asked

Build `/notes` as THE module a new project copies for its first list module: every house pattern done right, with
short comments that explain the why. Move the `note` table out of `ai.ts` into its own schema file and add pinned,
tags, archived. StatBand + one chart, toolbar (search, ReUI filters, one row on a phone), Active | Archived tabs on the
right, ReUI grid with a ceiling and a pinned action column, URL-keyed filters, keep-open sheet for create/edit,
`?open=<id>` deep link, ConfirmPopover for delete/archive, inline pin, CSV + PDF export, empty and error states.

## What "done" looks like

- `note` lives in `schema/notes.ts` (export `notes`, SQL `note`), with `updated_at`, `pinned`, `tags text[]`,
  `archived_at`; the AI tools (`saveNote`, `listNotes`, stats) still import `notes` from `@repo/db/schema`.
- `/notes` paints its skeleton at once (loading.tsx = the client's loading branch), the server seeds `initialData`
  under the same keys the client uses (one shared params parser).
- Search / tag / pinned / tab / page live in the URL via `history.replaceState`; the list is a URL-keyed query with
  `keepPreviousData` and a dimmed grid while it refetches.
- Rows open the keep-open sheet; another row swaps it; `?open=<id>` and `?open=new` open it from a link.
- Archive / delete confirm in a popover; pin toggles inline; mutations invalidate `["notes"]`.
- CSV of the loaded page, PDF of the whole view at `/api/documents/notes.pdf`.

---

## Tasks

- [ ] **1. Move the table, add columns, SQL script**
  - Acceptance: `notes` exported from `schema/notes.ts`, gone from `ai.ts`, index re-exports it; script is additive.
  - Verified: _(not run - typecheck is the lead's, once per wave)_
- [ ] **2. Types, zod schemas, server actions** (list, get, create, update, archive, delete, setPinned, stats)
  - Acceptance: every export checks the session, filters by `userId`, returns ActionResult.
  - Verified: _(not run)_
- [ ] **3. Page, loading, skeleton, client, sheet, query plumbing**
  - Acceptance: the "done" list above.
  - Verified: _(not run - no dev server in this wave)_
- [ ] **4. `notes.pdf` document**
  - Acceptance: signed-in user's notes in the current tab / search / filters.
  - Verified: _(not run)_

---

## Verification pass

- [ ] Typecheck (scoped) -> lead runs it
- [ ] `/notes` opened, phone width in an iframe -> owner / lead
- [ ] `psql -f packages/db/scripts/notes-columns.sql` twice on an existing database -> owner

## Notes / decisions

- The export stays `notes` (the brief said `note`; the code already exported `notes` and the AI tools and erasure use it).
- Archived is the Active | Archived TAB, not also a filter chip - two controls for one switch disagree.
- Column headers do not sort: the list is paged on the server, so sorting one page would mislead. Order is pinned
  first, then last edited.
- CSV exports the page on screen (its button says so); the PDF covers the whole view (up to 2,000).
- `apps/main` needs `@tanstack/react-table` and `recharts` (ui's peer) in package.json - listed, not added.
- Code for tasks 1-4 is written (2026-11-23); every box stays open until the lead's scoped typecheck and a browser
  pass. `lib/notes.ts` holds the reads (server-only) because a 'use server' export taking a `userId` would be a public
  endpoint that reads anyone's notes.
- The AI `listNotes` tool still lists archived notes too; left as is (lib/ai/tools.ts is not this job's file).
