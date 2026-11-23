import type { ReactNode } from "react"
import { cn } from "@repo/ui/lib/utils"

/**
 * Small pieces the grid, the sheet and the export share.
 *
 * Dates are formatted in UTC on purpose: the server renders the first page and the browser hydrates it, and a date
 * formatted in two different time zones is a hydration mismatch. A product with a tenant or profile time zone passes
 * it here (`timeZone`) - one place to change.
 */
const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const DATE_TIME = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
const WEEK = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

export function formatNoteDate(iso: string | null | undefined, withTime = false): string {
    if (!iso) return "-"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "-"
    return (withTime ? DATE_TIME : DATE).format(d)
}

/** A week bucket's label on the chart axis: "17 Nov". */
export function formatWeekLabel(weekStart: string): string {
    return WEEK.format(new Date(`${weekStart}T00:00:00Z`))
}

/** One tag. Neutral, like every chip - the word carries the meaning, not a colour. */
export function TagChip({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <span className={cn("inline-flex max-w-[10rem] items-center truncate rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300", className)}>
            {children}
        </span>
    )
}

/** Up to `max` tags, then "+N" - a row never grows taller because one note has many tags. */
export function TagList({ tags, max = 3 }: { tags: string[]; max?: number }) {
    if (tags.length === 0) return <span className="text-xs text-neutral-500">-</span>
    const shown = tags.slice(0, max)
    const more = tags.length - shown.length
    return (
        <div className="flex min-w-0 items-center gap-1 overflow-hidden" title={tags.join(", ")}>
            {shown.map((t) => <TagChip key={t}>{t}</TagChip>)}
            {more > 0 ? <span className="shrink-0 text-xs text-neutral-500">+{more}</span> : null}
        </div>
    )
}
