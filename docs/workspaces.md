# Adding workspaces (teams) - a guide for when a product needs them

Basecode ships **without** workspaces on purpose (owner, 2026-11-23): most products start with one person per account,
and a tenant column on every table is expensive to add early and cheap to add on a clear day. This guide is the plan for
that day. It describes the shape the owner chose: **every person gets a personal workspace, and can create or join
shared ones.**

## What changes for the person

- After sign-up they land in **their personal workspace** (named after them). Nothing else looks different.
- The rail gets a **workspace switcher** at the top (personal + every shared one, "Create workspace", "Invite people").
- In a shared workspace, notes, AI chats and billing belong to the WORKSPACE, not the person. Members see the same notes;
  AI chats stay private to whoever started them unless shared (decide per product).
- Roles: **owner** (billing, delete, transfer), **admin** (invite, remove, settings), **member** (use the product).
  Products add custom permissions on top (see "Permissions" below) - never gate on the role name in code.

## The building blocks

1. **better-auth organization plugin** (in `@repo/auth`, the sole owner of better-auth). It brings `organization`,
   `member`, `invitation` tables, invitations by email, roles, and `session.activeOrganizationId`. Add the plugin on the
   server and `organizationClient()` on the client; run `ALLOW_DB_PUSH=1 pnpm db:push` only if the database is still
   fresh, otherwise write an additive SQL script in `packages/db/scripts/` (AGENTS.md section 6).
2. **Personal workspace on sign-up**: in the auth `databaseHooks.user.create.after`, create an organization with
   `metadata: { personal: true }` and the user as owner, then set it active on the first session
   (`databaseHooks.session.create.before` -> `activeOrganizationId`). A personal workspace cannot be left or deleted
   while the account exists, and cannot have members (hide "Invite" there) - or allow it, if the product wants
   "upgrade personal to team".
3. **A tenant column on every product table**: `workspaceId text not null references organization(id)`, plus an index
   `(workspace_id, created_at)`. Today's tables that need it: `note`, `ai_conversation` (and its messages through the
   conversation), `notification` (keep `userId` too - notifications are per person), billing (below). Backfill: each
   existing row gets its owner's personal workspace id (a script, run twice, prints counts).
4. **One guard**: `requireWorkspace()` in `apps/main/lib/workspace.ts` - reads the session's active workspace, checks
   membership (fresh read, never trust a cookie for a write), returns `{ workspaceId, role, permissions }`. Every query
   filters by `workspaceId` (AGENTS.md: every tenant row carries its tenant id and every query filters by it). Every
   `'use server'` export calls it.
5. **Billing owner**: `@repo/billing` keys everything by a billing account. Today that account belongs to a user; with
   workspaces, a shared workspace gets its own billing account (owner pays), the personal workspace keeps the user's.
   Plans, periods, credits and payments do not change - only who the account belongs to.
6. **The AI page**: the per-turn context (after the history - never in the cached start) gains the workspace name and
   the person's role; tools read and write within `workspaceId`. The system prompt and tool list stay byte-identical
   across workspaces so the cache still hits.

## Permissions

Gate on permissions, not role names (AGENTS.md section 4 in the products that have it):
- A catalogue in `apps/main/lib/permissions.ts` (`notes:read`, `notes:write`, `billing:manage`, `members:invite`...).
- Owner/admin/member map to default sets; a workspace may define custom roles (`workspace_role`: name, permissions[]).
- One resolver `resolvePermissions(userId, workspaceId)`, computed live; `<Can permission="...">` in the UI,
  `requirePermission(...)` on the server. An assigned custom role is authoritative even when empty.

## Screens to add

| Screen | Where | Notes |
|---|---|---|
| Workspace switcher | top of the rail | Shows the active one; personal first; "Create workspace" opens a sheet |
| Members | `/settings/members` | Table with role Select per row, remove via ConfirmPopover, pending invitations |
| Invite | sheet from Members | Emails + role; sent through `@repo/email` (transactional) |
| Accept invitation | `/join?token=` (main) | Signed out: sign up / sign in first, then join; reuse the auth frame |
| Workspace settings | `/settings/workspace` | Name, logo (R2 key), danger zone: transfer ownership, delete (erasure job) |
| Billing | `/settings/billing` | Already exists; becomes per workspace |

## Order of work (each step ships on its own)

1. Plugin + personal workspace on sign-up + switcher (no shared workspaces visible yet).
2. `workspaceId` on every table, backfill script, `requireWorkspace()` everywhere. Verify: two accounts never see each
   other's notes or chats (open both in two browsers).
3. Create / invite / accept / members screens.
4. Billing per workspace.
5. Custom roles and permissions, only if the product needs more than owner / admin / member.

## Pitfalls already paid for elsewhere

- **Filtering on a role enum** returned "0 teachers" for a 154-person tenant: a person's job is not `user.role`.
- **A layout guard is not enough**: a `'use server'` export is a public endpoint and must check membership itself.
- **Cache keys** (TanStack): include the workspace id, or switching workspace shows the previous one's list.
- **Switching workspace** must clear the query cache and hard-navigate, or a stale page renders the old tenant's data.
- **Erasure** of a workspace deletes its files in storage first, then rows in dependency order (sequential, idempotent -
  `db.transaction()` throws on neon-http), and records the request.
