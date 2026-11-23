# Layout - pages, sidebar, chat

## Page

- Title 20px (`text-xl`) at 500-600, never bold; ONE muted 14px description line under it.
- Content in a centred column (runable ~1036px; ours `max-w-7xl` shell, narrower for reading pages), generous top space.
- The page's main action top right; if it has several ways in, a split button - not a row of buttons.
- A filter row: search takes the slack, chips size to their content; on a phone one row (search + one menu).
- More than one filter group, or a long one: a "Filters" button opening the `FilterSheet`, never a long dropdown.
- An empty list says what is missing with the shared `EmptyState` (icon stack, title, one line) - not a bare sentence;
  "no match for these filters" is a different message from "nothing yet".
- Lists are rows, not cards: a row has an icon, a title, a muted meta line, and one verb on the right.

## Sidebar

- Separated from the page by tone, not a border or shadow. Active item = soft fill, `rounded-xl`.
- Groups get a small muted label that collapses ("Projects v", "History v").
- The FOOTER: the assistant (Ask Saathi / Ask Vidya) on its own full-width row, then ONE row - the account chip (opens
  the account menu on hover) + round icons for the inbox and notifications.
  Credits, profile, settings, appearance, sounds, help, what's new and sign out all live in the account menu.
- A "Get started" checklist card can sit above the footer for new accounts (runable: three ticks + Upgrade).

## Chat (the assistant's page)

- Empty chat: the shared `ChatStart` - mark, greeting, one question, then soft group cards (Create as tiles, Ask as
  rows). The composer stays pinned at the bottom of the column (we keep it there; runable puts it under the question).
- The right column (Saathi's side column) starts at 500px, narrower only when the chat would drop under 560px; a drag
  is remembered per browser.
- Composer: a white (dark: one step up) box, `rounded-2xl`, the text area on top, a row of quiet controls under it
  (attach, mode, model, voice); an attached tinted TRAY below the box for secondary choices (project, plugins).
- A conversation: the transcript and the composer share one reading width; frame lines (two hairline rails with a
  "+" where they meet the header rule) mark that width on a wide screen.
