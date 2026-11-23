# apps/admin - the internal admin console

Team, access, users, audit log, reports, communications and system settings. Port 3101. Sign-in is `/` (email +
access code / password), invitations land on `/join`. The root `AGENTS.md` holds every general rule; this is only what
is specific to the console.

## Access

- `lib/permissions.ts` is the catalogue (`ADMIN_MODULES`, levels read / write / delete / full) and the one check,
  `adminCan(admin, module, level)`. SUPER_ADMIN passes everything; a TEAM_MEMBER holds exactly what is stored on their
  access row - an empty set means nothing, never "the defaults".
- `lib/admin-session.ts` (server only): `getAdmin()` (React-cached) and `requireAdminPage(module?, level?)`. **Every
  page.tsx calls `requireAdminPage(...)` first** - signed out or inactive goes to `/`, a missing permission goes to
  `/accessdenied` (the 403 screen). Every `'use server'` export checks the admin itself too.
- Client components read `useAdminAccess()` (`context/admin-access-context.tsx`), seeded by the server layout - no
  fetch, no flash. `PermissionGate` hides PART of a screen (a write button); it never gates a whole page.

## Layout

- `app/(main)/layout.tsx` is a SERVER layout: `getAdmin()` + the rail cookie (`ADMIN_RAIL_COOKIE`), then `AdminShell`
  (`app/(main)/_components/admin-shell.tsx`), the shared `AppShell` with this admin's rail. The rail is built on the
  client from `adminNavFor(admin)` in `lib/navigation.ts` (its icons are components and cannot cross from the server).
- The layout imports only `actions/shell.action.ts` (the bell, the sign-in stamp). A `'use server'` file registers
  every export on every route whose tree imports it, so the shell never imports the big action files.
- Route constants: `ROUTES` in `lib/navigation.ts`. URLs carry no hyphens (`/reports/adminactivity`).
- The shell does not pad; `Page` pads its header and content column (`px-4`, max-w-7xl, `reading` = 3xl); never pad a page root again. Pages are `Page` + a `loading.tsx` drawn with
  `PageSkeleton` and the real static title.

## Screens

- Headline numbers: one `StatBand`. Lists: a ReUI `DataGrid` (users, audit log) or a shadcn `Table` inside a
  horizontal `ScrollArea` with the action column pinned to the end; every list has a ceiling and scrolls inside.
- A row with 2+ fields opens the non-modal right Sheet; rows carry `data-sheet-keep-open` so pressing another row swaps
  it. Routine confirms are a `ConfirmPopover` on the button; a dialog only for big or irreversible actions (sending a
  broadcast to everyone).
- Typography as in `apps/main/CLAUDE.md`: page `<h1>` `text-xl` through `Page` only, sections and sheet titles
  `text-base`, `font-semibold` the ceiling, nothing below `text-xs`.
