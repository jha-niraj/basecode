"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"

/**
 * A row of pill chips that narrows a list - All / Active / Paused (clean controls, Niraj 2026-11-23, after
 * runable.com). 36px pills; the chosen one gets a soft tint and full ink, the rest muted ink - never bold, never a
 * bordered box round the row. Header TABS are not this: tabs switch the page's view and sit right of the title.
 *
 * A long set is ONE button with a dropdown (AGENTS.md "a long chip set is one button"): past `collapseAfter`
 * options, or always under `sm` when `collapseOnPhone`, the row becomes a single chip naming the choice.
 */
export interface ChoiceChip<V extends string> {
    value: V
    label: string
    /** Optional count, drawn muted after the label. Leave it out rather than show 0. */
    count?: number
}

export function ChoiceChips<V extends string>({
    options,
    value,
    onChange,
    collapseAfter = 6,
    collapseOnPhone = true,
    label,
    className,
}: {
    options: ChoiceChip<V>[]
    value: V
    onChange: (value: V) => void
    collapseAfter?: number
    collapseOnPhone?: boolean
    /** Accessible name for the group, e.g. "Status". */
    label: string
    className?: string
}) {
    const current = options.find((o) => o.value === value) ?? options[0]
    const menu = (
        <DropdownMenu>
            <DropdownMenuTrigger className={cn(chipClass(true), "gap-1.5 pr-3")} aria-label={label}>
                {current?.label}
                <ChevronDown aria-hidden className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {options.map((o) => (
                    <DropdownMenuItem key={o.value} onSelect={() => onChange(o.value)}>
                        <span className="flex-1">{o.label}</span>
                        {o.count !== undefined ? <span className="text-xs tabular-nums text-neutral-400">{o.count}</span> : null}
                        {o.value === value ? <Check aria-hidden /> : null}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
    if (options.length > collapseAfter) return <div className={className}>{menu}</div>
    return (
        <div className={cn("min-w-0", className)}>
            {collapseOnPhone ? <div className="sm:hidden">{menu}</div> : null}
            <div role="radiogroup" aria-label={label} className={cn("flex-wrap items-center gap-2", collapseOnPhone ? "hidden sm:flex" : "flex")}>
                {options.map((o) => {
                    const on = o.value === value
                    return (
                        <Button
                            key={o.value}
                            type="button"
                            variant="ghost"
                            role="radio"
                            aria-checked={on}
                            onClick={() => onChange(o.value)}
                            className={chipClass(on)}
                        >
                            {o.label}
                            {o.count !== undefined ? (
                                <span className="ml-1.5 text-xs tabular-nums opacity-60">{o.count}</span>
                            ) : null}
                        </Button>
                    )
                })}
            </div>
        </div>
    )
}

function chipClass(on: boolean): string {
    return cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center rounded-full border px-4 text-sm font-medium outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        on
            ? "border-neutral-950/[0.07] bg-neutral-950/[0.07] text-neutral-900 dark:border-white/[0.1] dark:bg-white/[0.1] dark:text-neutral-50"
            : "border-neutral-950/[0.06] bg-transparent text-neutral-500 hover:bg-neutral-950/[0.04] hover:text-neutral-800 dark:border-white/[0.07] dark:text-neutral-400 dark:hover:bg-white/[0.05] dark:hover:text-neutral-100",
    )
}
