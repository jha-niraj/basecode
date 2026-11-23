"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "../lib/utils"
import { startThemeTransition } from "./themeprovider"

/**
 * The sidebar theme control (owner, 2026-11-22): a tiny two-icon segmented pill `[ sun | moon ]`
 * with the active side highlighted and no text label. Replaces the "Light theme" / "Dark theme"
 * text button in the footer row of main, admin and firm.
 *
 * Every visual state comes from the `dark:` variant (the class next-themes'
 * blocking script sets on <html> before first paint), never from a React read, so the server
 * and first client render are byte-identical and the pill is right on the very first frame.
 * `aria-pressed` is the one thing that needs the resolved theme, so it is filled in after mount
 * (an attribute change, nothing visible).
 *
 * `compact` is for a collapsed rail: ONE 28px button showing the active icon that toggles.
 * Every change runs through `startThemeTransition`, so the directional wipe is kept.
 */
export function ThemeSwitch({ compact = false, className }: { compact?: boolean; className?: string }) {
    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => setMounted(true), [])
    const isDark = mounted && resolvedTheme === "dark"

    const go = (next: "light" | "dark", e: React.MouseEvent) => {
        // Read the live class, not resolvedTheme: a press on the already-active side is a no-op.
        const nowDark = document.documentElement.classList.contains("dark")
        if ((next === "dark") === nowDark) return
        startThemeTransition(() => setTheme(next), { x: e.clientX, y: e.clientY })
    }

    if (compact) {
        return (
            <button
                type="button"
                aria-label="Toggle theme"
                title="Toggle theme"
                onClick={(e) => go(document.documentElement.classList.contains("dark") ? "light" : "dark", e)}
                className={cn(
                    "cursor-pointer flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white dark:focus-visible:ring-neutral-500",
                    className,
                )}
            >
                <Sun className="h-4 w-4 dark:hidden" aria-hidden />
                <Moon className="hidden h-4 w-4 dark:block" aria-hidden />
            </button>
        )
    }

    // ONE switch (owner, 2026-11-23): a click anywhere on the pill flips the theme - you never
    // have to aim at the other half. The knob slides under the active icon; visuals come from
    // the `dark:` variant so the first paint is right before hydration.
    const flip = (e: React.MouseEvent) =>
        go(document.documentElement.classList.contains("dark") ? "light" : "dark", e)
    return (
        <button
            type="button"
            role="switch"
            aria-label="Dark theme"
            title="Switch theme"
            aria-checked={mounted ? isDark : undefined}
            onClick={flip}
            className={cn(
                "relative inline-flex h-7 w-[60px] shrink-0 cursor-pointer items-center rounded-full border border-neutral-200 bg-neutral-50 p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 dark:focus-visible:ring-neutral-500",
                className,
            )}
        >
            <span
                aria-hidden
                className="absolute left-0.5 top-0.5 h-[22px] w-7 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none dark:translate-x-[28px] dark:bg-neutral-700"
            />
            <span aria-hidden className="relative z-10 flex h-[22px] w-7 items-center justify-center text-neutral-900 dark:text-neutral-500">
                <Sun className="h-3.5 w-3.5" />
            </span>
            <span aria-hidden className="relative z-10 flex h-[22px] w-7 items-center justify-center text-neutral-500 dark:text-white">
                <Moon className="h-3.5 w-3.5" />
            </span>
        </button>
    )
}
