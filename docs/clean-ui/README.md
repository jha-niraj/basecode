# Clean UI - what we learned from runable.com, and the rules we keep

A self-contained folder: copy it into any project (basecode, synchq, vidhica, rakamhq...) and point that project's
agents at it. Measured on runable.com (signed in: `/`, `/scheduled`, `/artifacts`) on 2026-11-23 with Chrome's computed
styles, then mapped to NEUTRAL greys (we do not copy runable's warm beige).

| File | What it holds |
|---|---|
| `README.md` | The ideas, in one page - read this first |
| `controls.md` | Exact values for every control (button, split button, menu, input, chips, empty state, account menu) and the Tailwind classes we use |
| `layout.md` | Page, sidebar, chat composer and empty-page rules |
| `prompt.md` | A short prompt to paste into another Claude session to apply all of this |

Reference implementation: `packages/ui/src/components/` (here and in Gurukul) - `ui/button.tsx`, `ui/split-button.tsx`,
`ui/dropdown-menu.tsx`, `ui/select.tsx`, `ui/input.tsx`, `ui/textarea.tsx`, `ui/choice-chips.tsx`,
`ui/empty-state.tsx` (`EmptyState` + `SuggestionList`), `ui/filter-sheet.tsx` (`FilterSheet`), `account-menu.tsx`
(`AccountMenu` + `AccountMenuIcon`), `chat-start.tsx` (`ChatStart`; in Gurukul under `saathi-chat/`).

## The ideas (why it looks clean)

1. **Separate by TONE, not by lines.** A menu, an input, the sidebar, a chip are each one step of grey off what they
   sit on, with an edge of 5-8% black (white in dark mode). No white boxes with grey borders, no hard shadows.
2. **One size for every control: 36px.** Buttons, inputs, selects, chips, menu rows. The page reads as one system.
3. **Corners by role:** controls 12px (`rounded-xl`), floating surfaces (menus, the composer, cards that float)
   16px (`rounded-2xl`), chips and the account chip fully round.
4. **Weight stops at medium (500), titles at semibold (600).** Nothing bold. Hierarchy comes from size and grey, not weight.
5. **Thin 16px icons** in menus and rows, muted grey - the text carries the meaning.
6. **One way in, several options = a split button.** "Create v" opens "Create with AI" / "Set up manually". Never
   two buttons side by side for the same job.
7. **Never an empty page.** Empty = icon, one line, ONE button, then a short "Suggestions" list of useful first moves.
   A short list with room under it gets the same list.
8. **The sidebar is for navigation.** Everything personal (credits, profile, settings, appearance, sounds, help,
   sign out) lives in ONE account menu opened (on hover) from a chip at the bottom showing the first name; the
   assistant gets its own full-width row above it, and only the inbox and notifications stay as round icons beside it.
9. **One typeface** for the whole app (we use Hanken Grotesk in the student app; runable uses ID Grotesk).
10. **Filters that do not fit go in a sheet** of chip groups, never a long dropdown.
11. **Space over chrome:** a centred column, generous top space, a one-line grey description under the title.

## What we did NOT copy

- The warm beige tint (we use neutral greys - Niraj, 2026-11-23).
- Coloured category icons (runable tints each tool's icon; our rules keep colour for data and state).
- The sparkle icon for AI - never, anywhere. Use a chat bubble (`MessageCircle` / `MessagesSquare`).
