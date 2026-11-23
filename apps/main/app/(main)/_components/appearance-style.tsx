import type { AppearancePrefs } from "@/lib/settings-values"

/**
 * The account's density and motion prefs as plain CSS, rendered by the server layout so the very first frame is right
 * (no flash of the comfortable size). Renders nothing for the defaults.
 *
 * - Compact: the root font-size drops to 15px, so every rem-based size (text, spacing, controls) shrinks with it.
 * - Reduce motion: animations and transitions stop, the same as the device's prefers-reduced-motion.
 */
const COMPACT = "html{font-size:15px}"
const STILL = "*,*::before,*::after{animation-duration:0.01ms!important;animation-iteration-count:1!important;transition-duration:0.01ms!important;scroll-behavior:auto!important}"

export function AppearanceStyle({ prefs }: { prefs: AppearancePrefs }) {
    const css = `${prefs.density === "compact" ? COMPACT : ""}${prefs.reducedMotion ? STILL : ""}`
    if (!css) return null
    return <style data-app-appearance="" dangerouslySetInnerHTML={{ __html: css }} />
}
