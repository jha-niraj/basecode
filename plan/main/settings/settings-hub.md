# Settings hub, notifications, home, welcome, help

| | |
|---|---|
| **App / module** | `main/settings` (+ notifications, home, welcome, help) |
| **Status** | In progress |
| **Opened** | 2026-11-23 |
| **Last updated** | 2026-11-23 |
| **Files** | `packages/db/src/schema/settings.ts`, `packages/db/src/schema/core.ts` (user.onboardedAt), `packages/db/scripts/settings-tables.sql`, `apps/main/app/(main)/settings/**` (not billing), `apps/main/app/(main)/notifications/**`, `apps/main/app/(main)/home/**`, `apps/main/app/(main)/help/**`, `apps/main/app/(onboarding)/**`, `apps/main/actions/{settings,dashboard,onboarding,help}.action.ts`, `apps/main/actions/notification.action.ts`, `apps/main/lib/settings.ts`, `apps/main/app/(main)/layout.tsx`, `apps/main/app/(main)/_components/main-shell.tsx`, `packages/ui/src/components/ui/notifications-panel.tsx` (footer prop) |

## What was asked

Build the Settings hub (section rail: Notifications, Appearance, Connected accounts, AI usage, Billing link, Profile
link), a /notifications page and the bell sheet (latest 10 + See all), a /home dashboard (StatBand, AI chats per day
chart, recent activity, quick links), a /welcome onboarding shown once after first sign-in, and /help (shortcuts, FAQ,
contact form via @repo/email to SUPPORT_EMAIL).

## What "done" looks like

- `/settings` redirects to `/settings/notifications`; every section page has a loading.tsx; the rail is a left column on
  desktop and a Select on a phone; `/settings/billing` renders inside the same layout (Payments agent's page).
- Preferences are saved per user (`notification_preference`, `user_setting`); density and reduced motion apply app-wide
  from the server layout with no flash.
- Google can be linked / unlinked; unlinking the last sign-in method is refused with the reason.
- AI usage shows windowed buckets, a daily cost chart (30 days) and a recent-calls table with a ceiling.
- `/notifications`: All | Unread tabs on the right, mark one / all read, delete (ConfirmPopover), rows link to
  actionUrl, pagination outside the ScrollArea, empty state. Bell sheet shows the latest 10 + "See all".
- `/home`: StatBand (notes, AI chats, AI cost this month, unread), chats-per-day chart (14 days), recent activity, quick
  links.
- `/welcome`: one stepped card (name + photo, use, terms, done -> /ai); the (main) layout sends a person with
  `onboarded_at` null there.
- `/help`: shortcuts, FAQ accordion, contact form (toast; a clear note when SUPPORT_EMAIL is not set).

## Open questions

- Notes table export: the brief said `note`, but schema/notes.ts (Notes agent) exports `notes` (table `note`) with
  `archivedAt` / `updatedAt`. lib/dashboard.ts imports `notes` and counts active (not archived) notes.
- /welcome lives in its own route group `(onboarding)` (a server layout cannot read the pathname, so a redirect in the
  (main) layout would loop if /welcome sat under it; it also gets a focused page without the rail).

---

## Tasks

- [ ] **1. Schema: settings.ts (notification_preference, user_setting), user.onboarded_at, idempotent SQL script**
  - Acceptance: tables exported from schema/index.ts; script runs twice cleanly.
  - Verified: _not run - subagent; lead runs the script on the database._
- [ ] **2. Settings layout + section rail + redirect + four section pages with loading.tsx**
  - Verified: _not run - subagents never typecheck; lead's pass._
- [ ] **3. /notifications page + bell sheet (latest 10, See all)**
  - Verified: _code written 2026-11-23; not typechecked or opened (subagent rule) - lead's pass._
- [ ] **4. /home dashboard**
  - Verified: _code written 2026-11-23; not typechecked or opened (subagent rule) - lead's pass._
- [ ] **5. /welcome onboarding + layout redirect**
  - Verified: _code written 2026-11-23; not typechecked or opened (subagent rule) - lead's pass._
- [ ] **6. /help**
  - Verified: _code written 2026-11-23; not typechecked or opened (subagent rule) - lead's pass._

---

## Verification pass

- [ ] Typecheck (scoped, lead) -> _pending_
- [ ] Pages opened: /settings/*, /notifications, /home, /welcome, /help -> _pending_
- [ ] Owner runs: `pnpm lint`, build, the SQL script on staging

## Notes / decisions

- Density = `compact` sets the root font-size to 15px (every rem-based size shrinks with it); reduced motion stops
  animations and transitions. Both are a `<style>` the server layout renders, so the first frame is right.
- The layout's onboarding + appearance read is ONE cached `db.batch` (`lib/settings.ts`).
- Theme stays in next-themes (browser) - it already applies before paint; it is not stored server-side.
- Unlinking Google is refused (server-side, `unlinkGoogle`) when there is no password: the email code still works for a
  confirmed address, but Google would be the only SAVED method. better-auth refuses the last account anyway.
- `createNotification` takes an optional `topic`; with it, a person who turned that topic's in-app switch off gets none.
- NotificationsPanel (packages/ui) gained an optional `footer` prop for the bell's "See all" link.
- Help shortcuts list only what exists: Cmd/Ctrl+\ (use-pin-peek) and Cmd/Ctrl+J (AI page). No command palette in the
  shell, so no Cmd/Ctrl+K row.
- SUPPORT_EMAIL added (blank) to apps/main .env, .env.local, .env.production. Blank = the contact form is off with a note.
- Existing users have `onboarded_at` null, so they see /welcome once after the column lands (not live - accepted).
