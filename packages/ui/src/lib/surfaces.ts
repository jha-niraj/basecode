/**
 * The shared surfaces of the app shell, as constants so the rail, a right column and the phone bar cannot drift
 * apart (each panel writing its own background by hand drifted once - two shades of white side by side).
 *
 * The shell is FLUSH and SQUARE: no rounded frame, no hairline. Chrome separates from the page by a soft shadow
 * (owner, 2026-11-23: "the hairline was not looking good").
 */

/** The rail and any full-height right column: white / a step above the dark page ground, no border. */
export const SHELL_SURFACE = "bg-white dark:bg-[#161718]"

/** The soft shadow a left rail casts onto the page (to its right). */
export const SHELL_SHADOW_LEFT = "shadow-[1px_0_0_rgba(0,0,0,0.03),6px_0_24px_-12px_rgba(0,0,0,0.12)] dark:shadow-[1px_0_0_rgba(0,0,0,0.4),6px_0_24px_-10px_rgba(0,0,0,0.6)]"

/** The soft shadow a right column casts onto the page (to its left). */
export const SHELL_SHADOW_RIGHT = "shadow-[-1px_0_0_rgba(0,0,0,0.03),-6px_0_24px_-12px_rgba(0,0,0,0.12)] dark:shadow-[-1px_0_0_rgba(0,0,0,0.4),-6px_0_24px_-10px_rgba(0,0,0,0.6)]"

/** The phone bottom bar's shadow, cast upwards. */
export const SHELL_SHADOW_TOP = "shadow-[0_-1px_0_rgba(0,0,0,0.04),0_-6px_20px_-12px_rgba(0,0,0,0.14)] dark:shadow-[0_-1px_0_rgba(0,0,0,0.4),0_-6px_20px_-10px_rgba(0,0,0,0.6)]"

/** The page canvas behind every page. */
export const PAGE_GROUND = "bg-white dark:bg-[#121314]"

/**
 * The raised thin-shadow surface with no padding: sections sit on a very thin shadow instead of a hairline. Same
 * tone as `PANEL` in components/ui/section-panel.tsx, for frames that pad themselves (a table's ScrollArea, a list).
 */
export const SURFACE =
    "rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.04] dark:bg-neutral-900 dark:shadow-[0_1px_2px_rgba(0,0,0,0.5)] dark:ring-white/[0.06]"
