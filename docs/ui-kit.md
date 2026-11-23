# UI kit - `packages/ui` (`@repo/ui`)

Every shared component, hook and helper the apps draw with. Read the file's own header comment before using a piece:
most carry the reason they exist and the trap they fix. The rules these components encode live in `AGENTS.md`
section 10 (UI) and section 11 (data fetching and navigation) - this page says WHICH piece to reach for, not the rule
again.

"Used by" counts imports in `apps/main`, `apps/admin` and `packages/auth/src` (counted 2026-11-23). "Unused by the apps
today" means no app imports it directly; it may still be used inside `@repo/ui` (noted) and is kept as a ready part.

## How to import

The `exports` map in `packages/ui/package.json`:

| Pattern | Resolves to | Example |
|---|---|---|
| `@repo/ui/components/ui/<name>` | `src/components/ui/<name>.tsx` | `@repo/ui/components/ui/page` |
| `@repo/ui/components/<path>` | `src/components/<path>.tsx` (nested paths work) | `@repo/ui/components/shell/app-shell`, `@repo/ui/components/reui/data-grid/data-grid` |
| `@repo/ui/hooks/<name>` | `src/hooks/<name>.ts` | `@repo/ui/hooks/use-url-tab` |
| `@repo/ui/lib/<name>` | `src/lib/<name>.ts` | `@repo/ui/lib/utils` (`cn`) |
| `@repo/ui/components/ui/shader-palettes` | `src/components/ui/shader-palettes.ts` (the one `.ts` under ui) | |
| `@repo/ui/styles/globals.css` | `src/styles/globals.css` | imported once in each app's `app/layout.tsx` |
| `@repo/ui/postcss.config` | `postcss.config.mjs` | |

**Tailwind sources.** `globals.css` declares `@source "../components/**/*.tsx"`, `@source "../lib/**/*.ts"` and
`@source "../../../auth/src/**/*.{ts,tsx}"` (the auth pages are drawn by `@repo/auth/ui`; without that line they render
unstyled). A new package that ships class names needs its own `@source` line here. Dark mode is
`@custom-variant dark (&:is(.dark *))` (next-themes sets the class).

---

## Layout and shell

| Piece | Import | When |
|---|---|---|
| `AppShell` | `components/shell/app-shell` | THE signed-in shell (main `MainShell`, admin `AdminShell`). Flush rail, pin or peek (cookie), `Cmd/Ctrl+\`, phone tab bar, `NavProgress`, staggered rail prefetch, publishes `--app-page-h`. Never pads the page. Used by 2. |
| `ShellRail`, `AccountRow` | `components/shell/shell-rail` | The rail's content: brand, nav, then the footer - an optional assistant row (`AppShell` `assistant`) and ONE row: the account chip + the bell. Rendered by `AppShell` in the desktop rail and the phone "More" sheet; apps do not import it. |
| `AccountMenu`, `AccountMenuIcon` | `components/account-menu` | The account chip (first name) that opens on hover: credits box (`account.credits`), Profile, Settings (`account.settingsHref`), the app's `links`, Appearance (Dark / Light / System), Sounds, Sign out. `AccountMenuIcon` = the round 40px icons beside it. |
| `ChatStart` | `components/chat-start` | A new chat's start screen: mark, greeting, question, groups of tiles (make) and rows (ask); a group without a label is bare. The composer stays below it. |
| `SplitButton` | `components/ui/split-button` | One action with 2-4 ways in (label, divider, chevron; the whole button opens the menu). In a page header give the `PageAction` an `options` array. |
| `ChoiceChips` | `components/ui/choice-chips` | Pill filters; one menu on a phone or past 6 options. |
| `FilterSheet` | `components/ui/filter-sheet` | Filters that do not fit a toolbar: a Filters button with a count opening a sheet of chip groups (live, Clear all / Done). Never a long dropdown. |
| `lib/shell` | `lib/shell` | Nav types (`ShellNavItem`, `ShellNavSection`, `ShellUser`), `railPinnedFromCookie`, `railWidthCookie`, `railWidthFromCookie`, `RAIL_WIDTH`, `isUnder`, `activeHref`, `tabItems`. Plain module: the server layout reads the rail cookie with it. Used by 5. |
| `MobileTabBar` | `components/ui/mobile-tab-bar` | The phone bottom bar; drawn by `AppShell` (4 `tab: true` items + More). Not imported by apps. |
| `NavProgress` | `components/nav-progress` | 2px top bar from click to commit. One per shell; `AppShell` mounts it. |
| `AppLink`, `markNavPending` | `components/app-link` | Every link (`next/link` is lint-banned). Prefetches the shell on intent. Call `markNavPending(href)` before a programmatic `router.push`. Used by 25. |
| `useStaggeredPrefetch` | `components/use-staggered-prefetch` | The rail's prefetch queue (one every 350ms from idle). `AppShell` runs it; a second sidebar would call it too. |
| `ThemeProvider`, `startThemeTransition` | `components/themeprovider` | next-themes + a View Transitions wipe. Mounted in each app's `providers.tsx`. Used by 3. |
| `ThemeSwitch` | `components/theme-switch` | Sun / moon pill - no longer in the rail (Appearance lives in the account menu); kept for a settings page. |
| `ResizableSplit` | `components/ui/resizable-split` | Two panes with a drag handle, stacked below `from`. For split editors. Unused by the apps today. |
| `Docks` (`MagneticDockRow`) | `components/ui/docks` | A macOS-style magnifying dock. Unused by the apps today. |
| `AnnouncementBar` | `components/ui/announcement-bar` | In-flow strip above a marketing nav. Unused by the apps today. |
| `ScrollReveal` | `components/scroll-reveal` | framer-motion reveal on scroll, for public pages. Unused by the apps today. |
| `ShaderHeroBg` / `shader-palettes` | `components/ui/hero-shader-bg`, `components/ui/shader-palettes` | WebGL hero backgrounds (lazy client only). Import the palettes from `shader-palettes` in a server component. Unused by the apps today. |
| `GrainCover` | `components/ui/grain-cover` | Decorative grainy gradient cover; never behind data. Unused by the apps today. |

## Page

| Piece | Import | When |
|---|---|---|
| `Page`, `PageSkeleton`, `PageDescription` | `components/ui/page` | EVERY page and its `loading.tsx`. One header row (title, badges, one-line description with tooltip), tabs on the right (`?tab=`), `actions` collapsing into More, `back`, `extra`. `width`: default max-w-7xl, `"reading"` (max-w-3xl, forms and settings), `"full"` (board, split editor). `body`: `"scroll"`, `"fill"` (page bounds its own panes), `"page"` (dashboard scrolls whole). `bleed` (or `data-page-bleed`) takes the whole box with no padding - the AI page. Pass `PageSkeleton` the same title, tab count, action count and width. Used by 52. |
| `HeaderSlot`, `IntoHeaderSlot` | `components/ui/header-slot` | Let a panel lower down draw a control into the page header (a period picker beside the tabs). Unused by the apps today. |
| `SectionPanel`, `PanelHeading`, `PanelRows`, `PANEL_*` | `components/ui/section-panel` | The raised section card for reading and form pages (profile, settings, admin settings); 40px rows. No "use client", so server skeletons share it. Used by 11. |
| `PanelHeader` | `components/ui/panel-header` | Header for a docked right-hand panel (picker left, icon actions right). Unused by the apps today. |
| `skeleton-kit` (`Shimmer`, `SkeletonCard`, `StatRowSkeleton`, `FilterBarSkeleton`, `TableSkeleton`, `BoundedPageSkeleton`...) | `components/skeleton-kit` | Region skeletons that mirror real layout components one for one. Compose them inside `PageSkeleton` from `page`. Note it ALSO exports a `PageSkeleton`; the apps use the one from `components/ui/page`. Used by 12. |

## Sheets and overlays

| Piece | Import | When |
|---|---|---|
| `Sheet`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`, `SHEET_EXIT_MS` | `components/ui/sheet` | The right sheet. NON-MODAL by default: an outside press closes it unless the target carries `data-sheet-keep-open` (rows that open or swap it). `modal` for a sheet that must block. `onExitComplete` to reset content; `SHEET_EXIT_MS` before navigating after a close. Use for any list item with 2+ fields and any 3+ field form. Used by 9. |
| `useSheetSwap`, `SheetDiscardBar` | `components/ui/sheet-swap` | Keep-open lists with a dirty-form guard when a row press swaps the sheet. Unused by the apps today (Notes and admin key the form by id instead). |
| `FormSheet` | `components/ui/form-sheet` | A ready form sheet: header band, scrolling body, footer that never scrolls away, `<form>` round both. Unused by the apps today; admin has its own `apps/admin/components/side-sheet.tsx` doing the same. |
| `useKeptDraft` | `components/ui/kept-draft` | A sheet draft that survives closing until saved (`clear()`). Unused by the apps today. |
| `Popover`, `PopoverTrigger`, `PopoverAnchor`, `PopoverContent` | `components/ui/popover` | Small choices on a button; `PopoverAnchor` positions without becoming the trigger. Used by 5. |
| `ConfirmPopover`, `ConfirmMenuItem` | `components/ui/confirm-popover` | ROUTINE one-item confirms (archive, delete one row, revoke a session): a popover on the caller's own button, focus on Cancel. The default confirm. Used by 16. |
| `AlertDialog` | `components/ui/alert-dialog` | Centred dialog for BIG or irreversible actions only (delete with cascade, refund, ban). Unused by the apps directly. |
| `ConfirmDialog` | `components/ui/confirm-dialog` | A ready confirm dialog on `AlertDialog`. Same "big actions only" rule. Unused by the apps today. |
| `useConfirm`, `usePrompt` | `components/ui/use-confirm` | Promise-style themed replacements for `window.confirm` / `window.prompt`. Unused by the apps today; prefer `ConfirmPopover`. |
| `Dialog` | `components/ui/dialog` | Plain centred dialog (shadcn). Used inside `command`. Unused by the apps directly. |
| `DropdownMenu` | `components/ui/dropdown-menu` | Menus (Page's "More", row menus). A confirm from a menu opens after the menu closes (`ConfirmMenuItem`). Unused by the apps directly. |
| `Tooltip`, `TooltipProvider` | `components/ui/tooltip` | Closes when the pointer leaves the trigger. One `TooltipProvider` in each app's providers. Used by 3. |
| `TipLayer` | `components/ui/tip-layer` | One layer that turns every `data-tip="..."` into a shadcn tooltip; mount once at the root. Not mounted by the apps today. |
| `TruncatedText` | `components/ui/truncated-text` | One line cut with an ellipsis, tooltip only when actually cut. Unused by the apps today. |
| `Command` | `components/ui/command` | cmdk primitives (Radix needs a `title`; it is screen-reader only). Used inside phone-input and the palettes. |
| `CommandPalette`, `openCommandPalette`, `useCommandPaletteShortcut` | `components/ui/command-palette` | Cmd+K palette anchored near the top. Unused by the apps today. |
| `NavCommandPalette` | `components/ui/nav-command-palette` | A navigation palette with fuzzy scoring and server-found groups. Unused by the apps today. |
| `NotificationsPanel` | `components/ui/notifications-panel` | The bell's sheet (latest items, mark all read, footer slot). Used by main and admin shells. |

## Tables, lists and ReUI

| Piece | Import | When |
|---|---|---|
| `Table`, `TableHead`, `TableCell`... | `components/ui/table` | A plain table inside `<ScrollArea orientation="horizontal">` with a `min-w-[...]` inner element. `scroller="parent"` when it already sits in a ScrollArea (sticky header works). `pin="end"` on the action column's `TableHead` and `TableCell`; there is no `pin="start"`. Used by 10. |
| ReUI DataGrid (`data-grid`, `data-grid-table`, `data-grid-scroll-area`, `data-grid-column-header`, `data-grid-column-visibility`, `-pagination`, `-cell-selection`, `-column-filter`, `-table-dnd`, `-table-dnd-rows`, `-table-virtual`) | `components/reui/data-grid/<file>` | TanStack Table grid: sorting, column visibility, pinning, selection, virtual rows, drag. Use for a real list module (Notes, admin Users, audit log). A short fixed list stays a `Table`. Used by Notes and admin. |
| ReUI Filters (`filters`, `filters-query`, `filters-types`, plus builder / chip / date / editors / operators / i18n) | `components/reui/filters/<file>` | Chip filters whose query lives in the URL. Import the plain `filters-query` / `filters-types` from server code (Notes' `notes-query.ts` does); `filters.tsx` is client. Used by Notes and admin. |
| `matchesFilterQuery` | `lib/filter-match` | Apply a Filters query to rows already in the browser. Server-filtered lists send the query to the action instead. Used by 2. |
| `ChipFilters` | `components/ui/chip-filters` | Thin wrapper over ReUI Filters for one-value-per-field lists (`Record<key, value>`). Unused by the apps today. |
| `ListToolbar` | `components/ui/list-toolbar` | One-row toolbar: search, chip filters, sort; below `sm` search + one Filters button opening a bottom sheet. Unused by the apps today. |
| `ListPagination`, `paginate` | `components/ui/list-pagination` | The pager, OUTSIDE the ScrollArea; buttons disable, never hide. Used by 4. |
| ReUI Cascader | `components/reui/cascader/<file>` | Multi-column hierarchical picker (async, virtual). Unused by the apps today. |
| ReUI Event calendar | `components/reui/event-calendar/<file>` | Month / week / day / agenda / resource views with an external CRUD contract; reads `@repo/calendar` for BS. Unused by the apps today. |
| ReUI `Badge` | `components/reui/badge` | ReUI-variant badge recoloured to the house palette (no green surfaces). Used inside ReUI parts. The shadcn `Badge` is `components/ui/badge` (used by 3). |
| `KanbanBoard` | `components/kanban-board` | Columns with drag between them (`onMove`); one horizontal ScrollArea, each column its own vertical one. Unused by the apps today. |
| `SortableList` | `components/sortable-list` | THE reorder control (drag by grip, `moveItem` from `@repo/core/list/move-item`). Never up/down arrows. Unused by the apps today. |
| `dnd` | `components/dnd` | Re-exports `@dnd-kit/core` so apps never list it themselves. Unused by the apps today. |
| `Tree`, `useTree` | `components/ui/tree` | headless-tree tree view. Unused by the apps today. |
| `NavTree` | `components/ui/nav-tree` | A navigate-only tree (select opens the screen's sheet). Unused by the apps today. |
| `Timeline` | `components/ui/timeline` | Vertical timeline primitives. Unused by the apps today. |
| `selectableRowProps`, `openableRowProps` | `lib/selectable-row` | Whole-row click toggles selection / opens, skipping inner controls. Unused by the apps today. |
| `PendingRow`, `usePendingRow` | `components/ui/pending-row` | Mark the row just pressed while its sheet loads. Unused by the apps today. |
| `ExportCsvButton` | `components/export-csv-button` | The one CSV export (BOM, escaping from `@repo/core/csv`). Used by Notes. |

## Forms and fields

| Piece | Import | When |
|---|---|---|
| `Button`, `buttonVariants` | `components/ui/button` | Every button (`rounded-xl` built in). Never a native `<button>`. Used by 49. |
| `ButtonGroup` | `components/ui/button-group` | Joined buttons. Unused by the apps directly. |
| `ActionLabel` | `components/ui/action-label` | A button label that collapses to icon-only on small screens without leaving the accessibility tree. Unused by the apps today. |
| `Input`, `Textarea`, `Label` | `components/ui/input`, `components/ui/textarea`, `components/ui/label` | Text fields. Textarea grows with content. Used by 25 / 7 / 15. |
| `InputGroup` | `components/ui/input-group` | Input with addons (icon, button, text). Unused by the apps directly. |
| `Field` | `components/ui/form-field` | Labelled field that shows its own error; pairs with `useFormErrors`. Unused by the apps today (auth-kit has its own `Field`). |
| `Select` (`SelectTrigger`, `SelectContent` with `emptyMessage`...) | `components/ui/select` | Every select; `h-9` default. Never native `<select>`. Used by 8. |
| `Checkbox`, `RadioGroup`, `Switch` | `components/ui/checkbox`, `components/ui/radio-group`, `components/ui/switch` | Boolean and one-of controls. Used by 2 / 1 / 7. |
| `CheckboxMultiSelect` | `components/ui/checkbox-multi-select` | Checkbox dropdown with picked chips under it; empty = all. Use instead of a long chip wrap. Unused by the apps today. |
| `Tabs` | `components/ui/tabs` | Tabs with a sliding highlight. For page tabs pass `tabs` to `Page` instead. Used by 1. |
| `DatePicker` | `components/ui/date-picker` | THE date control, value `YYYY-MM-DD` (AD). Never `<input type="date">`. Unused by the apps today. |
| `NepaliDatePicker`, `NepaliCalendar` | `components/ui/nepali-date-picker` | A general Bikram Sambat (BS) picker that emits the AD `Date`. Keep it for products that show BS dates (Nepal); others use `DatePicker`. Unused by the apps today. |
| `Calendar`, `CALENDAR_SURFACE` | `components/ui/calendar` | react-day-picker month grid and the one popover surface both pickers float on. Used inside the pickers. |
| `MonthPicker`, `monthLabel` | `components/ui/month-picker` | Pick a `YYYY-MM` month. Unused by the apps today. |
| `TimePicker` | `components/ui/time-picker` | Typed segments + clock popover, value `HH:mm`. Never `<input type="time">`. Unused by the apps today. |
| `NumberField`, `NumberStepper` | `components/ui/number-field` | Number with steppers, arrow keys, scrub (base-ui). Unused by the apps today. |
| `PhoneInput` | `components/ui/phone-input` | E.164 phone with searchable country list (react-phone-number-input). New code uses this. Unused by the apps today. |
| `CountryPhoneInput` | `components/ui/country-phone-input` | Compatibility wrapper over `PhoneInput` for older call sites; country data from `@repo/core/geo`. Unused by the apps today. |
| `LocationSelector` | `components/ui/location-selector` | Nepal province / district and India state picker - product-flavoured data. Unused by the apps today. |
| `InputOTP` | `components/ui/input-otp` | Code boxes; used by the auth kit's `CodeInput`. |
| `PasswordStrength`, `passwordScore` | `components/ui/password-strength` | Strength meter. Unused by the apps today: the auth pages use `PasswordStrength` from `@repo/auth/ui` (a second copy). |
| `ColorField` / `ColorPicker` | `components/ui/color-field`, `components/ui/color-picker` | A colour setting (presets, recents, contrast check) / the full picker it wraps. Unused by the apps today. |
| `IconPicker` | `components/ui/icon-picker` | Pick one icon from a map the caller injects. Unused by the apps today. |
| `FileDropzone` | `components/ui/file-dropzone` | Drag-drop picker with a per-file progress queue; the app supplies `upload(file, onProgress, signal)`. Unused by the apps today (profile avatar uses its own input). |
| `FileTypeIcon`, `fileKind` | `components/ui/file-type-icon` | Neutral icon by MIME / extension. Used inside the dropzone. |
| `SignatureField` / `SignaturePad` | `components/ui/signature-field`, `components/ui/signature-pad` | Draw or upload a signature, returns a `File`. Unused by the apps today. |
| `RichText`, `sanitizeRichText` | `components/ui/rich-text` | Render editor HTML sanitized with the `rte-output` styles (never `prose`). Used by admin. |
| Typed fields (`FieldDefEditor`, `TypedAnswerInput`, `TypedAnswerView`, `fieldDefsToFlowSteps`) | `components/typed-fields/<file>` | User-defined questions on `@repo/core/typed-fields` (editor, answer control, read-only view, Typeform steps). Unused by the apps today. |
| `TypeformFlow` | `components/typeform-flow` | One-question-at-a-time wizard (text, choice, file, location steps). Unused by the apps today. |
| `FlowSteps`, `FlowStepsSkeleton` | `components/ui/flow-steps` | Neutral step indicator for a multi-step flow (the flow keeps its own state). Used by `/welcome`. |
| `Stepper` | `components/ui/stepper` | ReUI stepper primitives under `FlowSteps`. |

## Feedback and loaders

Pick by size (`AGENTS.md` section 10, "Loading states"):

| Piece | Import | When |
|---|---|---|
| `InlineLoader` | `components/ui/inline-loader` | A control's own action (submit, row save, toggle, a quiet "refreshing" hint). Used by 21. |
| `Spinner` | `components/ui/spinner` | The bare in-flight mark, sized like an icon; `InlineLoader` draws it. Use `InlineLoader` in app code. |
| `Skeleton` | `components/ui/skeleton` | Shimmer block (pass `delay` to ripple). A region with a shape gets a skeleton drawn to its layout; never a centred spinner. Used by 24. |
| `AppLoader` | `components/ui/app-loader` | Whole page / route transition: draws the flow-loader family; pass `kind` when the destination is known. Used by both apps' `(main)/loading.tsx` fallback. |
| `FlowLoader` | `components/ui/flow-loader` | The scenes (`page`, `list`, ...). Through `AppLoader`. |
| `PageLoader`, `SectionLoader` | `components/ui/loader` | Older centred loaders. Unused by the apps today; use `AppLoader` or a skeleton. |
| `Progress`, `ProgressSteps` | `components/ui/progress` | REAL progress only (bytes, done/total). Unused by the apps today. |
| `toast`, `Toaster` | `components/ui/toast` | Sonner-compatible toasts (success, error, promise, undo, progress); one `Toaster` top-right in providers. Used by 26. |
| `toastError` | `components/ui/toast-error` | Toast a failed `ActionResult` with an honest title and Retry only when retryable. Unused by the apps today. |
| `EmptyState`, `SuggestionList` | `components/ui/empty-state` | The one empty state (`bordered`, icon, title, description, action, up to 4 `suggestions` - useful first moves). `SuggestionList` is the same list on its own, for a short list with room under it. Nothing to do shows nothing, not an empty panel. |
| `InlineNote` | `components/ui/inline-note` | Icon + text note that wraps correctly (a failed refresh, a caveat). Used by 5. |
| `DataError` | `components/ui/data-error` | Inline failed-load state with Retry from a failed result. Unused by the apps today. |
| `Alert` | `components/ui/alert` | shadcn alert box. Unused by the apps today. |
| `StatusView` | `components/ui/status-view` | 404 / 500 / 403 screens (`kind` = `not-found`, `error` or `forbidden`, `fullScreen`, `actions`). Used by `not-found.tsx` and `/accessdenied`. |
| `AppErrorView` | `components/ui/app-error-view` | The body of every `error.tsx`: `classifyError` picks the copy, a transient blip retries once. Used by 4. |
| `SigningInScreen` / `SigningOutScreen` / `SessionScreen` | `components/ui/signing-in-screen`, `components/ui/signing-out-screen`, `components/ui/session-screen` | Door scene from a successful sign-in / sign-out until the next page lands. Sign-in used by auth forms; sign-out drawn by `ShellRail`. |
| `RelativeTime`, `formatRelativeTime` | `components/ui/relative-time` | "9h ago" with no hydration mismatch. Use instead of formatting `new Date()` in render. Used by 10. |
| `Kbd` | `components/ui/kbd` | Keyboard key caps (Help page, composer). Used by 2. |
| `Avatar`, `Card`, `Separator`, `Accordion`, `Collapsible`, `Badge` | `components/ui/<name>` | shadcn basics. `Card` sets `h-full`; add `h-auto` for a band. |
| `IconStack`, `DotmSquare11` | `components/ui/icon-stack`, `components/ui/dotm-square-11` | Decorative icon container / dot-matrix animation. Used inside `EmptyState` / one other ui file only. |
| `sounds` (`playSound`, `SoundToggle`) | `components/ui/sounds` | Web Audio notification sounds with one preference. Unused by the apps today. |

## Charts and numbers

| Piece | Import | When |
|---|---|---|
| `StatBand`, `StatBandSkeleton` | `components/ui/stat-band` | Headline numbers, always ONE band (`{ icon, label, value, hint?, tone?, href? }` (or `onClick` + `active`)); skeleton with the same `count`/`cols`/`size`. See also `src/components/ui/STAT-BAND.md`. Used by 32. |
| `StatStrip` | `components/ui/stat-strip` | Quick-link / action tiles only, never figures. Used by `/home`. |
| `ChartPanel`, `TrendLineChart`, `CategoryBarChart`, `SplitBarChart` | `components/charts/panel-charts` | The house chart panels for module first pages: one metric, real units, neutral ink, amber on the one datum, null = gap. Used by 6. |
| `ChartEmpty` | `components/charts/chart-empty` | The "no data yet" picture every chart shows when empty. Drawn by `panel-charts`. |
| `TrendChart` | `components/ui/trend-chart` | A single figure over time, compact (not a dashboard panel). Unused by the apps today. |
| `ResponsiveChart` | `components/ui/responsive-chart` | `ResponsiveContainer` that never logs the -1 size warning; give its parent a set height. Used inside `panel-charts`. |
| `ChartContainer`, `ChartTooltip`... | `components/ui/chart` | shadcn chart primitives. Unused by the apps today. |
| `ChartGrainDefs` | `components/ui/chart-grain` | Grain gradient fills for chart marks. Unused by the apps today. |
| `lib/chart-theme` | `lib/chart-theme` | Series colours, grid / axis / legend props for recharts. Used by the chart files. |
| `useChartMotion` | `hooks/use-chart-motion` | The house load animation for recharts marks (`popClass` for the amber dot). Used by `panel-charts`. |

## AI

| Piece | Import | When |
|---|---|---|
| `ReasoningSteps` | `components/ui/reasoning-steps` | The turn's work as it happens: folded "Working..." row, thinking text, tool steps with durations. Used by `apps/main/components/ai/chat-message.tsx`. |
| `Trace` | `components/ui/trace` | The shimmer trace primitives under `ReasoningSteps`. |

The rest of the AI page (composer, transcript, cards, side column, peeks) lives in `apps/main/components/ai` and
`apps/main/components/peeks` - see `docs/ai.md`.

## Hooks

| Hook | Import | When |
|---|---|---|
| `useUrlTab` | `hooks/use-url-tab` | A tab kept in `?tab=` via `history.replaceState` (no server re-render). Used by 4. |
| `useDebounce` | `hooks/use-debounce` | Debounce a search value before it becomes a query key. Used by 3. |
| `useSignOut` | `hooks/use-sign-out` | Sign-out used by `ShellRail` (POST `/api/sign-out`, clear the QueryClient, hard-navigate). `@repo/auth/client` exports another `useSignOut` with the same job (used once in main). |
| `usePinPeek` | `hooks/use-pin-peek` | Rail pin / peek state and cookie; used by `AppShell`. |
| `useFormErrors` | `hooks/use-form-errors` | Collect every field error, scroll to the first, show it at the field (with `Field`). Unused by the apps today. |
| `useFileUpload`, `formatBytes` | `hooks/use-file-upload` | File selection state for `FileDropzone`. |
| `useJobPoll` | `hooks/use-job-poll` | Poll a long job until it finishes (`AGENTS.md` section 5, long jobs). Unused by the apps today. |
| `useRecentPicks` | `hooks/use-recent-picks` | Recent items in localStorage (wrapped, can be empty). Used by the command palette. |
| `useAutoHideHeader` | `hooks/use-auto-hide-header` | A header that hides on scroll down. For public pages. Unused by the apps today. |

## lib and styles

| Module | Import | Holds |
|---|---|---|
| `utils` | `lib/utils` | `cn` (clsx + tailwind-merge). Used by 26. |
| `surfaces` | `lib/surfaces` | `SHELL_SURFACE`, `SHELL_SHADOW_LEFT/RIGHT/TOP`, `PAGE_GROUND`, `SURFACE` - the shell's flush surfaces and shadows. Used by 4. |
| `glass` | `lib/glass` | Glass and panel surface class strings (`GLASS_PANEL`, `SURFACE_SHEET`...). Also exports a `SHELL_SURFACE` of its own - not the same constant as `lib/surfaces`. |
| `motion` | `lib/motion` | `POPPER_MOTION`, `POPPER_ORIGIN`, `COLLAPSE_MOTION` for overlays. |
| `fuzzy-search` | `lib/fuzzy-search` | `fuzzyScore`, `scoreCandidate` for search boxes and palettes. |
| `styles/globals.css` | `styles/globals.css` | Tailwind 4 import, `@source` lines (above), theme tokens (light and dark), `gk-shimmer`, grain covers, `rte-output`, chart pop. |

ScrollArea (`components/ui/scroll-area`, used by 27): `orientation` defaults to `"both"`; use `"vertical"` for lists and
chat (it pins its child to `block` so nothing scrolls sideways), `"horizontal"` round a table. Put a list's ceiling on
`viewportClassName="max-h-[...]"`, never on the root. No `<ScrollBar>` child, no native `overflow-*-auto`.

## Product-flavoured leftovers

Carried over from earlier products; generic code works, names or data do not:
- `phone-input` / `country-phone-input`: `SchoolCountryProvider`, `useSchoolPhoneCountry`; defaults to Nepal outside a provider.
- `location-selector`: Nepal provinces / districts and India states data.
- `nepali-date-picker`, `event-calendar-system`, typed fields: call `@repo/calendar`'s `formatSchoolDate` family (BS / AD). The BS picker itself is general - keep it.
- Header comments that point at files not in this repo: `sheet-swap.tsx` (`apps/main/app/(main)/settings/staffcredits`), `form-sheet.tsx` (`docs/ui-lessons.md`), `calendar.tsx` ("the Deck"), `stat-strip.tsx` (root CLAUDE.md "STATS ARE ONE BAND"), `list-pagination.tsx` (CLAUDE.md).
