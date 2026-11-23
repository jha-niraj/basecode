# Controls - exact values

Runable's measured value first, then what we use (neutral). Light / dark. "Fill" alphas work on any ground (page,
card, sheet), which is why we use them instead of a fixed grey.

## Tokens we use

| Role | Light | Dark |
|---|---|---|
| Control fill | `bg-neutral-950/[0.03]`, hover `/[0.06]` | `bg-white/[0.04]`, hover `/[0.08]` |
| Control edge | `border-neutral-950/[0.07]` | `border-white/[0.08]` |
| Floating surface (menu, select list) | `bg-neutral-50` + `ring-[0.5px] ring-neutral-950/10` | `bg-neutral-900` + `ring-white/10` |
| Soft shadow | `shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)]` | `rgba(0,0,0,0.6)` |
| Row hover / focus in a menu | `bg-neutral-950/[0.05]` | `bg-white/[0.07]` |
| Selected (chip, select item) | `bg-neutral-950/[0.07]` | `bg-white/[0.1]` |
| Primary (ink) button | `bg-neutral-900 text-neutral-50` | `bg-neutral-100 text-neutral-900` |

## Button

- Runable: 32-36px, radius 12, 14px/500, padding 8/16.
- Ours: `default` and `sm` = `h-9` (36px), `icon` = `size-9`, `lg` = `h-11` for hero buttons only. `rounded-xl`,
  `text-sm font-medium`. `outline` = the filled-soft control above (no white, no grey border).

## Split button (`SplitButton`, or `PageAction.options`)

- Runable "Create": 98x32, ink fill, radius 12, padding 8 8 8 12, gap 8; inside: label, a 1x16 divider at 20% of the
  text colour, a 16px chevron. The WHOLE button is one dropdown trigger.
- Ours: `h-9 rounded-xl pl-3.5 pr-2.5 gap-2`; divider `h-4 w-px bg-current opacity-20`; menu end-aligned, 4px gap.
- Use when one action has 2-4 ways in ("Add student" -> one / import a file / transfer in). One way = a plain button.
- In a page header: give the `PageAction` an `options` array; it renders as a SplitButton and, folded into "More",
  lists its options there.

## Menu (DropdownMenu, Select list)

- Runable: 224 wide, page-tinted fill, 0.5px edge at 5%, radius 16, padding 6, opens 4px under; rows 36px, radius 12,
  14px/500, padding 8 8 8 12, gap 12, 16px icon at stroke 1.
- Ours: content `rounded-2xl p-1.5` + floating surface tokens; item `min-h-9 rounded-xl px-3 py-2 gap-3 text-sm
  font-medium`, icons `size-4` muted. Destructive rows rose. Sub-menu trigger looks like a row with a chevron.

## Input, textarea, select trigger

- Runable search: 36px, fill one step off the page, 1px edge at 5%, radius 12, 14px/400, 40px left padding for its icon.
- Ours: `h-9 rounded-xl border` + control fill + control edge; hover one step darker; focus ring as before.

## Choice chips (`ChoiceChips`)

- Runable: 36px pills, 14px/500, padding 8/16; selected = 8% tint + full ink; idle = muted ink; 5% edge.
- Ours: `h-9 rounded-full px-4 text-sm font-medium`; selected `bg-neutral-950/[0.07] text-neutral-900`, idle
  `text-neutral-500`. More than 6 options, or a phone (`collapseOnPhone`), = ONE chip that opens a menu.
- Chips FILTER a list. Tabs switch a page's view and sit right of the title - not this.

## Filters that do not fit a toolbar (`FilterSheet`)

- A "Filters" button (the soft outline, a count when any is on) opens a right sheet; each group is a label and a WRAP of
  pill chips. The list behind updates as a chip is pressed - no Apply; the footer has Clear all and Done.
- Use it for 2+ filter groups or one long one (Studio: subject / kind / state - its menu ran off the screen). One short
  group stays in the toolbar as ChoiceChips. Never a long dropdown menu of radio items.

## Empty state (`EmptyState` + `SuggestionList`)

- Runable: centred icon, title, one sentence, ONE secondary button, a hairline, a small "Suggestions" label, then rows:
  icon, title + muted meta ("Weekdays at 8:00 AM"), one muted line.
- Ours: `EmptyState` gained `suggestions` (max 4: `{ title, meta?, description?, icon?, href | onSelect }`);
  `SuggestionList` is the same list standalone, for a short list with room under it. Title `font-medium`, not semibold.

## Account menu (`AccountMenu`, `AccountMenuIcon`)

- Runable: a chip (avatar + name) at the bottom of the rail with a bell and a device icon beside it. The menu: avatar,
  name, email; a credits box (fill one step darker, "0 left", Usage | Upgrade buttons); Invite (badge "Earn 20k
  credits"), Affiliate (outward arrow), Help >, Appearance >, Settings; a hairline; Log out in rose.
- Ours: chip `h-10 rounded-full` with a 32px avatar and the FIRST name only; menu `w-72`, opens upward (to the right on
  an icon rail) on HOVER (180ms grace to cross gaps; a click on an open chip does not toggle it shut; touch and
  keyboard press);
  credits box with secondary + primary buttons; app items (Profile, Settings, Guides, What's new...); Appearance
  sub-menu (Dark / Light / System via next-themes; the chosen row filled with a dot; picking one CLOSES the menu - a
  finished choice); a Sounds switch; Sign out. Controlled `open` so a hover rail stays out while the menu is open and
  closes with it. The credits buttons are menu items styled on the item itself (an `asChild` Button picked up the
  item's focus colours: transparent with black text). `AccountMenuIcon` = the round 40px icon buttons beside the chip (count dot, tooltip, link
  or press).

## Chat start screen (`ChatStart`, `@repo/ui/saathi-chat`)

- Runable home: a big question, the composer, then groups (Code / Productivity / Content Creation) - each a soft card
  (one tone off the page, 16px corners, a hairline) with a folding header and tiles inside (icon on top, title).
- Ours: mark, greeting (28px semibold; 18px docked), one muted question, an optional "You're on ..." pill, then
  groups: `tiles` (icon, title, one muted line - things to MAKE) and `rows` (icon + one line - things to ASK). The
  composer stays pinned at the BOTTOM (Niraj: "keep the input box at the bottom"), not under the greeting.
  `compact` for the ~460px dock. Group `bg-neutral-950/[0.025] ring-1 ring-neutral-950/[0.05]`, items `bg-white`
  (dark `bg-white/[0.04]`) with a 5-6% ring.

## Tailwind scanning (a trap we hit)

A shared package's classes only exist if the app's CSS scans that folder. `packages/ui` scanned only `components/`
and `lib/`, so the start screen's `dark:ring-white/[0.06]` (in `saathi-chat/`) was never generated and the ring fell
back to currentColor - solid white rings. Every folder that renders JSX goes on the `@source` list.
