# Clean controls (after runable.com) - the same kit Gurukul piloted

| | |
|---|---|
| **App / module** | `repo/ui` (packages/ui + apps/main, apps/admin) |
| **Status** | Done |
| **Opened** | 2026-11-23 |
| **Last updated** | 2026-11-23 |
| **Files** | packages/ui/src/components/{account-menu,chat-start}.tsx, ui/{button,dropdown-menu,select,input,textarea,empty-state,page,split-button,choice-chips,filter-sheet}.tsx, shell/{app-shell,shell-rail}.tsx, apps/main (main-shell, navigation, chat-welcome, notes-client), docs/clean-ui/**, docs/{README,ui-kit}.md |

## What was asked

The owner, 2026-11-23: after the Gurukul pilot of the runable.com-style controls (gurukulhq commit 108d447b0), "complete
the basecode one", check it in Chrome (sidebar and all), commit. The rules and values are in `docs/clean-ui/`.

## Tasks

- [x] Controls: buttons 36px, outline = soft fill + 6-8% edge; inputs / textareas / select triggers on the fill; menus and
  select lists soft (one tone off the page, hairline, rounded-2xl, p-1.5, soft shadow; rows 36px rounded-xl, thin icons,
  no outline). Applied to basecode's own files (they had drifted from Gurukul's: neutral names, field-sizing textarea).
- [x] New: SplitButton (+ `PageAction.options`), ChoiceChips, FilterSheet, EmptyState suggestions + SuggestionList,
  AccountMenu + AccountMenuIcon, ChatStart.
- [x] Shell footer: optional assistant row, then ONE row - the account chip (first name, hover-open, rounded-xl) + bell.
  The menu: credits (main: balance from getBillingOverview, Usage / Top up), Profile, Settings, Help, Appearance
  (Dark / Light / System, picking closes it), Sounds, Sign out. ThemeSwitch left the rail. AppShell holds a peeked rail
  while the menu is open and keeps it when the pointer comes back onto the rail.
- [x] main: Settings and Help left the rail for the account menu; the AI welcome is ChatStart (4 create tiles, icon and
  text in one row, then 2 questions with no header); Notes' "New note" is a split button (write it yourself / draft it
  with the AI).
- [x] docs/clean-ui copied in; docs/README and ui-kit.md updated.

## Verification pass

- [x] `tsc --noEmit` apps/main and apps/admin: exit 0.
- [x] Chrome :3100 - /ai (start screen, rail footer, account menu on hover with credits 500 left, Appearance sub-menu;
  unpinned rail stays when the pointer returns from the menu; chip corners), /notes (split button menu), /settings.
- [ ] Owner: `pnpm lint`, a build, deploys.
