# apps/main - the product

The signed-in app. After sign-in people land on the AI page `/ai` (full-page chat with a right column). Public pages:
`/` (landing), the auth pages, `/terms`, `/privacy`. Port 3100. The root `AGENTS.md` holds every general rule; this file
is only what is specific to this app.

## Layout

- `app/(main)/layout.tsx` is a SERVER layout: it reads the session (`getSession()` from `@/lib/session`, React-cached)
  and the rail cookie (`MAIN_RAIL_COOKIE`), then renders `MainShell` (`app/(main)/_components/main-shell.tsx`), which
  is the shared `AppShell` from `@repo/ui/components/shell/app-shell`. It never awaits page data.
- The rail lives in `lib/navigation.ts` (`MAIN_NAV`, `ROUTES`). To add a module: a folder under `app/(main)/`, a route
  constant, a rail item (`tab: true` to put it in the phone bottom bar). Profile is reached from the account row.
- Every page and every `'use server'` export checks the session itself; the layout's check is not enough.

### The shell does not pad. `Page` pads its own column.

`<main data-app-main>` takes the whole space beside the rail (owner, 2026-11-23: no frame of padding round the page) and
publishes `--app-page-h`, the exact height a bound page may take (on a phone it clears the 60px tab bar and the safe
area). `Page` puts its header and its content in one centred, padded column (`px-4`, 12px above the header) while its
scroll area spans the full box, so the scrollbar sits at the screen edge. A page root that adds `p-6` or `py-10`
doubles it.

- Default: `<Page>` content column is centred at `max-w-7xl`.
- `<Page width="reading">`: header and content in one max-w-3xl column (forms, Profile, settings sections).
- `<Page width="full">`: lifts the cap (a board, a split editor). Still padded.
- `<Page bleed>` (or `data-page-bleed` on any page root): takes the whole box - no padding, the full height, to the
  right edge - for a workspace that lays out its own columns. The AI page uses it.

## Typography and density

| Element | Class |
|---|---|
| Page `<h1>` (only through `Page`) | `text-xl font-semibold` - never a responsive step-up |
| Page description | `text-xs`, one line, full text in a tooltip |
| Section heading / `CardTitle` / `SheetTitle` | `text-base font-semibold` |
| Header buttons | `size="sm"`, icons `h-3.5 w-3.5` |
| Inputs, selects | `h-9 text-sm`, `rounded-xl` |
| Body, table cells | `text-sm` |
| Meta lines | `text-xs` |
| Stat value | `text-base` to `text-xl`, `font-semibold` |

`font-semibold` is the ceiling on every heading (no `font-bold`). Nothing below `text-xs`. A displayed VALUE (a name, a
figure) may be larger; this governs headings. `text-md` is not a Tailwind class.

Radius: `rounded-xl` on every Button, Input, SelectTrigger, Textarea. `rounded-full` only for real shapes (avatars,
dots, chips, round icon buttons). The shell itself is square.

## Sheets

- `SheetTitle` / `SheetDescription` carry the right sizes by default (`text-base` / `text-xs`) - never pass a size. A
  sheet is a panel over a page; its title must not out-rank the page title behind it.
- A form sheet: the `<form>` wraps the body's ScrollArea AND the `SheetFooter`, so Save never scrolls away.
- Reset a sheet's content in `onExitComplete`, never in `onOpenChange(false)` (it collapses while sliding out).

### A route-driven sheet closes to a destination, never `router.back()`

When a sheet's open state IS the URL, closing pushes the route behind it. `back()` pops one history entry - after a
sheet opened a sheet, or from a pasted link, that reopens the previous sheet or leaves the app.
- Work the destination out ONCE at mount (the router cache can keep a slot mounted after the URL moved).
- Flip `open` to false first, navigate after `SHEET_EXIT_MS` (from `@repo/ui/components/ui/sheet`), or the exit never
  plays.
- `router.back()` on a button labelled "Go back" on a full page is fine.

## This Worker has a 64 MiB ceiling

The app is ONE Cloudflare Worker (64 MiB uncompressed). What keeps it small - each line has cost megabytes elsewhere:
- Built with webpack (`next build --webpack`), never Turbopack (it copies shared server modules into every route).
- `patches/next@16.4.6.patch` stays; a new `next` version means re-making it.
- The server `splitChunks` hook in `next.config.js`; `"minify": true` and `"keep_names": false` in `wrangler.jsonc`.
- Fewer route entries: one dispatcher route plus rewrites (`/api/cron/[job]`, `/api/documents/[...path]`), not a new
  `route.ts` per endpoint; no API route for a read a Server Action can do.
- A `'use server'` file registers EVERY export on every route whose tree imports it. The layout imports only
  `actions/notification.action.ts` (the bell); guards and helpers live in `server-only` modules
  (`lib/notifications.ts` holds `createNotification` for exactly this reason).
