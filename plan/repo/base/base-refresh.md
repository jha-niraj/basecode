# Base refresh - everything learned in gurukulhq, synchq, vidhica, rakamhq and gymcrm

| | |
|---|---|
| **App / module** | `repo/base` (every app and package) |
| **Status** | In progress |
| **Opened** | 2026-11-23 |
| **Last updated** | 2026-11-23 |
| **Files** | whole repo - see each task |

## What was asked

Niraj, 2026-11-23: read gurukulhq, synchq, vidhica, rakamhq and moonshots/gymcrm (code and git history) and bring
every small and big UI / layout / rule / fix / package learned there into basecode, so a new project can be cloned
from it and started without fixing the same things again. No product pages are enforced except one: the main AI
page (the full-page chat with the right column - `~/Downloads/ai-chat-handoff.txt`, cost rules from
`~/Downloads/ai-cost-cutoff.txt`). Update the sidebar and shell (no rounded corners on the sidebar or the right
side), sheets instead of inline editing, the base rules, and the packages that every project ends up needing
(Sarvam, PDF, ...). Ask everything with the picker; test every page in Chrome; fix what looks odd.

## Decisions (pickers, 2026-11-23)

- **Platform:** Cloudflare Workers + Neon. Next at the latest (16.4.6), OpenNext, wrangler (staging top level +
  `env.prod`), Neon over HTTP with a bounded cold-start retry, three env files per app, deploy and env scripts.
- **Pages:** refresh the UI of most base pages - access / admin pages, sidebar, every base component; auth pages
  and the auth folder complete; the Profile page with every function working.
- **Shell:** flush and square (no rounded card, no rounded rail). Separation by a SOFT SHADOW, not a hairline
  ("the hairline was not looking good"). Rail pins or peeks (left-edge hover), Cmd+\ toggles, state from a cookie.
- **AI page:** full pattern with sample data - landing after sign-in, frame + welcome, streaming chat, question /
  confirm / form cards in the right column, History, peeks (one example kind), Needs you (empty example source),
  cost pass built in.
- **AI SDK:** the newest (`ai` 7, `@ai-sdk/anthropic` 4), carrying over the measured cost pass. Gurukul gets the
  same upgrade right after basecode (separate plan, separate commit).
- **Packages:** ai, sarvamai, pdf, email, payments (Stripe core), credits / usage meter, cron, crypto, legal +
  erasure, web data (Exa, Firecrawl) - "and anything else that would be useful".
- **Auth methods:** email + password, Google, email one-time code. (2FA and impersonation not picked.)
- **Rules:** AGENTS.md holds every rule; CLAUDE.md is ONE line importing it; per-app CLAUDE.md; plan/ convention.
- **TypeScript:** stays 5.9 (7 is out; Next's type step and typescript-eslint still need the JS API).
- **Test DB:** Niraj put DATABASE_URL and ANTHROPIC_API_KEY into apps/main/.env; every other key gets a local
  default; tested end to end in Chrome.

## What "done" looks like

- `pnpm install && pnpm dev` runs main (3100) and admin (3101) on Next 16 against Neon; `pnpm deploy:staging main`
  is the documented deploy (not run).
- Sign up, verify, sign in (password, Google button, email code), forgot / reset, sign out all work; Profile
  (details, avatar, password, sessions, delete account) works.
- After sign-in the user lands on `/ai`: welcome, a streamed answer, a question card in the right column answered
  there, a peek opening from a link, History listing the conversation; the dev log shows cache reads > 0 from the
  second request.
- Admin: every page in the new shell with the `Page` header; access matrix, invites, users (sheet), audit work.
- Every page opened in Chrome at desktop and phone width (390px iframe); 404 / 500 / 403 screens render.
- AGENTS.md lists every general rule; nothing product-specific (school, BS dates, brand palettes) in it.

---

## Tasks

### Phase 1 - foundation (me)
- [x] **1.1 Rules**: AGENTS.md (process, layout, sheets, data, speed, env, AI cost, server-work placement, numbers),
  one-line CLAUDE.md, apps/*/CLAUDE.md, plan/README + TEMPLATE + INDEX.
  Verified: AGENTS.md written (14 sections), CLAUDE.md = `@AGENTS.md`, plan/README.md + TEMPLATE.md + INDEX.md present.
  apps/*/CLAUDE.md are agent A's (2.A).
- [ ] **1.2 Platform**: Next 16.4.6 / React 19.3 in both apps; OpenNext + wrangler.jsonc (staging + env.prod,
  minify, keep_names false, nodejs_compat, placement) + worker entry; `.gitignore` (.open-next, .wrangler);
  `pnpm.overrides` (react-slot, zod one copy); turbo env list; fonts via next/font/local; middleware stays
  `middleware.ts` (OpenNext rejects Node proxy) and accepts `__Secure-` cookie.
  Done: root package.json (overrides react 19.3.1, react-slot>=1.2.4, one zod 4.6.7; patchedDependencies next@16.4.6),
  patches/next@16.4.6.patch, apps/{main,admin}/{next.config.js (webpack splitChunks, staleTimes, security headers,
  sign-out rewrite), open-next.config.ts (R2 incremental cache), wrangler.jsonc (staging top level + env.prod, minify,
  keep_names false, nodejs_compat, placement, account_id placeholder), worker.ts (sign-out before Next, cron map)},
  package.json on next 16.4.6 / react 19.3.1 / --webpack, .gitignore (.env.*, .open-next, .wrangler), turbo envMode
  loose. Verified: `pnpm install` done in 22s; next@16.4.6 installed with patch_hash; the patched line
  `isInitial()) continue` present in node_modules' flight-manifest-plugin.js. Fonts and middleware are agents A/B.
- [ ] **1.3 DB**: Neon HTTP client with bounded retry; schema split into `schema/*.ts`; `db:push` guarded by
  `ALLOW_DB_PUSH=1` (fresh DB only), additive SQL scripts after that.
  Done (code): packages/db/src/client.ts (neon-http + retry, from gurukul minus the impersonation guard), schema/
  {core,ai,billing,cron,legal,erasure,payments}.ts, scripts/guard-push.mjs, seed without a committed password
  (SEED_ADMIN_PASSWORD or printed once), @repo/crypto (scrypt password in better-auth format, safeEqual, AES-GCM with
  APP_ENCRYPTION_KEY). Old drizzle/ migrations removed (fresh DB). Verify at 3.2 (push + seed on the test DB).
- [x] **1.4 Env + deploy scripts**: three env files per app (.env.local / .env / .env.production), `env:check`,
  `env:set`, `deploy:staging|prod <app|all>`; local defaults filled for testing (values never printed).
  Verified: scripts/{env-files,env-check,env-set,env-restore,deploy}.mts ported (APPS main, admin); env files written by
  script (values never shown): .env.local (DATABASE_URL + ANTHROPIC_API_KEY copied from Niraj's .env, fresh
  BETTER_AUTH_SECRET / APP_ENCRYPTION_KEY / CRON_SECRET, localhost URLs), .env (staging, URL keys __PLACEHOLDER__),
  .env.production (placeholders). `git check-ignore apps/main/.env.production` -> ignored.

### Phase 2 - parallel builds (agents, disjoint folders; none typecheck or build)
Dispatched 2026-11-23 as four background agents with disjoint folders and shared contracts (getSession from
@/lib/session; @repo/auth/sign-out exports used by worker.ts; eraseUser; exaSearch; Page width="full"; SITE in
@repo/core/site).
- [ ] **2.A UI + shells**: packages/ui refresh (Page + PageSkeleton, SheetFooter band, keep-open non-modal sheet,
  Table pin, StatBand container query, status-view 404/500/403, flow loaders generic scenes, relative-time,
  signing-in/out screens, inline loader, skeleton kit, theme switch); main + admin shell (flush, shadow, pin/peek,
  cookie, phone bottom bar); admin pages relaid with Page.
- [ ] **2.B Auth + profile + email**: @repo/auth (sole better-auth owner, scrypt, cookie cache, email OTP,
  Google, safe returnTo, sign-out endpoint, getSession cached), @repo/email (Resend over fetch, typed kind),
  auth pages in main and admin, profile page (tabs ?tab=).
- [ ] **2.C AI**: @repo/ai on ai 7 (task -> model map, thinking per model, cache marks incl. one-hour start,
  per-turn block after history, failing-tool removal, step cap, usage sink), credits / usage meter + table, the
  /ai page (frame, welcome, chat, cards in the column, History, peeks, Needs you) with sample tools.
- [ ] **2.D Packages**: sarvamai, pdf, payments (Stripe), cron, crypto, legal, erasure, webdata (exa, firecrawl).

### Phase 2b - modules (pickers 2026-11-23, after the first Chrome pass)
Decisions: main ships Settings hub, Notes reference module, Billing; extra pages Notifications inbox, Home dashboard,
Onboarding, Help & shortcuts; Profile stays its own page (/profile). Payments: eSewa + Khalti (NPR), Razorpay + Cashfree
(INR), Stripe kept for card/USD - all inside @repo/payments behind one interface; keys in the env files. Billing: all three
models - prepaid plan periods, auto-renew where the gateway supports it, credit top-ups spent by AI usage. Teams /
workspaces: NOT built now - a guide doc instead (personal + shared workspaces, better-auth organization plugin).
Fixed in the first Chrome pass: Tailwind not scanning packages/auth (auth pages unstyled); auth frame rebuilt (product
left, form right, sign-in/up switch in the top bar, legal footer); Google button shown in dev with what to set; AI page
star removed, rails full height, header padded inside the rails; thinking steps wired (reasoning frames -> ReasoningSteps,
tool durations); stored `thought` part survives a refresh; ports moved to 3100/3101 (3000 is every other project's).
- [ ] **2b.S Settings hub + pages** (agent): /settings section rail (Notifications, Appearance, Connected accounts, AI
  usage, Billing slot), /notifications + bell sheet, /home, /welcome onboarding, /help.
  Chrome 2026-11-23 (dark, 1512px): /home (band, chart, recent, links), /settings/notifications|appearance|accounts|usage,
  /notifications (empty state), bell sheet, /help, /welcome walked end to end as a new account -> /ai. Fixed on the way:
  settings rail inset + reading width for form sections and Help (header and cards one column); dark --card =
  neutral-900 (chart panel was black); ReUI grid surface follows --card (pinned cell was black); bell sheet had no
  SheetTitle (Radix warning); settings-tables.sql applied twice. Typecheck pending (Payments agent still editing).
- [ ] **2b.N Notes reference module** (agent): /notes full CRUD pattern.
  Chrome: band, chart, grid with pinned actions, keep-open sheet via row press (?open=), footer band. notes-columns.sql
  applied twice via the new `pnpm --filter @repo/db sql <file> [--apply]` runner. AI listNotes now skips archived.
- [ ] **2b.P Payments + billing** (agent): five providers, plans/periods/subscriptions/credits, /settings/billing, admin view.
- [x] **2b.G Workspaces guide** (me): docs/workspaces.md.
  Verified: docs/workspaces.md written - personal + shared, better-auth organization plugin, tenant column + backfill,
  requireWorkspace guard, billing owner, AI context, permissions, screens, order of work, pitfalls.
- Owner feedback round (2026-11-23), done and seen in Chrome: no star icon anywhere (rail, welcome, home, notes, auth
  panel -> MessagesSquare; saved as a memory); shell no longer pads - Page pads its own column, scroll area to the edges;
  Page width="reading"; Profile identity card + one-row Sign out (Section `action`); rail drag-resizable 200-360px
  (cookie, no jump) + account row = profile link + sign-out button (no dropdown); menus gap-2 + gray -> neutral;
  textareas grow, no grabber; dates in client components use a fixed locale + timeZone (hydration); CommandDialog title.
- Found: better-auth drops an UNCONFIRMED password when the email is first confirmed by code (anti-takeover) - noted in
  AGENTS.md section 7.

- [x] **2b.D Docs pack** (agent + me): docs/README.md (start here, reading order, 37-row "where is X"), architecture,
  modules, ui-kit, data, ai, env-and-deploy, recipes, payments (me), workspaces; AGENTS.md points to docs/README.md;
  root README rewritten. Verified: 10 files, 1249 lines; spot-read README, payments.md written from the code.
- [x] **2b.F Fixes from the docs read-through** (2026-11-23):
  getSession no longer turns a read failure into "signed out" (a DB blip signed everyone out) - it throws to the error
  boundary; admin non-admin redirect loop fixed (`requireActiveAdmin` -> `/?denied=1`, middleware expires the cookie);
  admin invitations create role USER (role ADMIN gave main-app platform reads); invite token from crypto, 16 chars;
  joining with an existing email keeps that password and the page says so; 11 unused exported server actions removed
  (public endpoints) and checkAdminAccess kept as a private guard; settings-tables.sql backfills onboarded_at when it
  adds it; dead admin lib files + unused form-sheet removed; OPENAI_API_KEY dropped; session.ts server-only; stale
  comments (crypto, settings schema, app-shell, use-sign-out); AGENTS.md date helper names + package descriptions;
  last native buttons in the shell / notifications panel -> Button. Verified: tsc clean admin + ui + auth after.
- Open (decided not now, written down): legal re-acceptance when a terms version changes (needsAcceptance only runs in
  /welcome); broadcasts have no real send (needs a Workflow); announcements are not shown in main; admin actions still
  return their own `{ success, data, error }` shape rather than ActionResult; phone-input / location-selector default
  to Nepal; ~70 of 111 ui components unused by the apps (kept as the kit).

### Phase 3 - integrate and verify (me)
- [x] **3.1** Install, scoped typecheck per package (two at a time), fix.
  Verified 2026-11-23: tsc clean on all 18 packages and both apps (last run after every fix: admin-ok, main-ok).
- [x] **3.2** Create tables on the test DB, seed.
  Verified: fresh push (22 tables), then notes-columns.sql, settings-tables.sql, billing-2026-11-23.sql each applied
  twice with the run-sql runner; seed printed the super admin once.
- [x] **3.3** Chrome pass: every main + admin page, desktop and 390px; AI page cache numbers; fix and re-check.
  Verified: main - landing, signup, signin (password, email code, Google with the owner's account), /ai (cards in the
  column, 5-question flow, form save; cache 0% -> 77/88/95%), /home, /notes (+ sheet), /profile tabs, /settings (all
  sections), /settings/billing (+ checkout sheet with no gateway keys: Pay disabled, plain sentence), /checkout/<missing>
  -> 404 screen, /notifications, bell sheet, /help, /welcome as a new account; admin - sign-in, ?denied flow for a
  non-admin (no loop), /home, /users (grid + sheet), /billing, /admins/access; phone 390px - /ai, /home, /notes,
  /settings/billing. Fixed during the pass: admin sign-in 500 (icon components passed from a server page ->
  AdminAuthFrame client wrapper); billing star icon -> Gem. Not verifiable here: gateway paid/failed/verifying states
  (need sandbox keys).
- [x] **3.4** README rewrite (setup, env table, deploy), INDEX row, offer the commit.
  Verified: README.md rewritten (points to docs/README.md); INDEX rows for base-refresh, notes, settings, billing.

---

## Verification pass

- [ ] Typecheck: every package and both apps -> _result_
- [ ] Every page opened -> _list_
- [ ] Niraj runs: `pnpm lint`, `next build`, `pnpm deploy:staging all`

## Notes / decisions

- Research (2026-11-23): gymcrm and rakamhq were both cloned from basecode; their first commits fixed exactly
  phase 1 (Next 16 + OpenNext, neon-http since Workers have no TCP, `__Secure-` cookie, react-slot override,
  local fonts after a Google Fonts 404 failed a deploy, one sendEmail, flat shell). Basecode must already have them.
- Sarvam: no app uses the `sarvamai` npm SDK; every one talks to the API over fetch (Workers-safe). Same here.
- PDF: pdf-lib + fontkit (Workers-safe, used by gurukul, vidhica, rakamhq); unpdf for text extraction.
  @react-pdf (gymcrm) left out - heavier in a Worker.
