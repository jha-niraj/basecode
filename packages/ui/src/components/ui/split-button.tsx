"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"

/**
 * One button that opens a short menu of ways to do the same thing - "New homework" -> "Make with Saathi" /
 * "Set up yourself" (clean controls, Niraj 2026-11-23, after runable.com's Create). The label, a faint divider and a
 * chevron sit in ONE trigger: the whole button opens the menu, so there is no half that does something different from
 * the other. 36px, 12px corners, the menu end-aligned 4px under it.
 *
 * Use it when a create action has 2-4 ways in. One way = a plain Button; more than four = a page.
 */
export interface SplitButtonOption {
    label: string
    /** A 16px lucide glyph. Never Sparkles for AI - use a chat bubble (MessagesSquare / MessageCircle). */
    icon?: React.ReactNode
    onSelect: () => void
    disabled?: boolean
}

export function SplitButton({
    label,
    icon,
    options,
    variant = "primary",
    disabled,
    className,
    align = "end",
    iconOnly = false,
}: {
    label: string
    icon?: React.ReactNode
    options: SplitButtonOption[]
    /** `primary` = ink fill (the page's main action); `secondary` = the soft filled outline. */
    variant?: "primary" | "secondary"
    disabled?: boolean
    className?: string
    align?: "start" | "end"
    /** On a phone the label hides (screen readers keep it) and the button is icon + chevron; from `sm` it returns. */
    iconOnly?: boolean
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                disabled={disabled}
                className={cn(
                    "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl py-2 pl-3.5 pr-2.5 text-sm font-medium outline-none transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    "[&_svg]:size-4 [&_svg]:shrink-0",
                    variant === "primary"
                        ? "bg-neutral-900 text-neutral-50 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                        : "border border-neutral-950/[0.07] bg-neutral-950/[0.03] text-neutral-800 hover:bg-neutral-950/[0.06] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-neutral-100 dark:hover:bg-white/[0.08]",
                    className,
                )}
            >
                {icon}
                <span className={cn("truncate", iconOnly && icon && "sr-only sm:not-sr-only")}>{label}</span>
                <span aria-hidden className={cn("h-4 w-px bg-current opacity-20", iconOnly && icon && "hidden sm:block")} />
                <ChevronDown aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} className="min-w-[14rem]">
                {options.map((o) => (
                    <DropdownMenuItem key={o.label} disabled={o.disabled} onSelect={o.onSelect}>
                        {o.icon}
                        {o.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
