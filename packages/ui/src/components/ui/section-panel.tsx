import type React from "react"
import { cn } from "../../lib/utils"

// No "use client": pages and their server skeletons both draw from these, so the two keep one shape.

/**
 * The raised section panel for reading and form pages (profile, settings, credits, pricing in apps/main; settings in
 * apps/admin). Adopted by the owner on 2026-11-22 and tightened the same day ("one little card, it shouldn't take this
 * much space"): the raised elevation token, a hairline shadow, small padding, a small heading with a one-line
 * description, and 40px rows separated by spacing only. Stack panels with `gap-3`.
 *
 * `id` is the anchor a SectionNav tab scrolls to.
 */
export const PANEL =
    "min-w-0 scroll-mt-2 rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:px-4 sm:py-3.5 dark:bg-neutral-900 dark:shadow-[0_1px_2px_rgba(0,0,0,0.5)]"

/**
 * `variant="data"` is for a section that holds a StatBand, a chart or a table rather than label/value rows: the body
 * sits a little further from the heading and nothing inside is pulled out to the panel's edge, so a band or a
 * table's own ScrollArea lines up with the heading. The surface is the same.
 */
export type PanelVariant = "rows" | "data"

/** The body slot's classes, for a skeleton that draws its own heading (`PanelHeading`) and body. */
export const PANEL_BODY = "mt-2 min-w-0"
export const PANEL_BODY_DATA = "mt-3 min-w-0"

export function SectionPanel({ id, title, description, action, tone, variant = "rows", children, className, bodyClassName }: {
    id?: string
    title: React.ReactNode
    description?: React.ReactNode
    /** A link or button at the right of the heading ("Open Settings", "Sign out other devices"). */
    action?: React.ReactNode
    /** `danger` only tints the heading; the panel stays neutral. */
    tone?: "danger"
    variant?: PanelVariant
    children: React.ReactNode
    className?: string
    bodyClassName?: string
}) {
    return (
        <section id={id} aria-labelledby={id ? `${id}-title` : undefined} data-panel={variant} className={cn(PANEL, className)}>
            <PanelHeading id={id} title={title} description={description} action={action} tone={tone} />
            <div className={cn(variant === "data" ? PANEL_BODY_DATA : PANEL_BODY, bodyClassName)}>{children}</div>
        </section>
    )
}

export function PanelHeading({ id, title, description, action, tone }: {
    id?: string
    title: React.ReactNode
    description?: React.ReactNode
    action?: React.ReactNode
    tone?: "danger"
}) {
    return (
        <div className="flex min-h-8 min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
                <h2 id={id ? `${id}-title` : undefined} className={cn("text-sm font-semibold", tone === "danger" ? "text-red-700 dark:text-red-400" : "text-neutral-900 dark:text-white")}>
                    {title}
                </h2>
                {/* One line from sm (keep the copy short); a phone may wrap it rather than hide half of it. */}
                {description && <p className="text-xs text-neutral-500 sm:truncate dark:text-neutral-400">{description}</p>}
            </div>
            {action && <div className="flex shrink-0 items-center">{action}</div>}
        </div>
    )
}

/** Rows split by spacing, not lines. The negative margin lets a row's hover fill reach the panel's padding. */
export function PanelRows({ children, className }: { children: React.ReactNode; className?: string }) {
    return <dl className={cn("-mx-2 min-w-0", className)}>{children}</dl>
}

/**
 * One fact: label in a fixed left column (about a third), value beside it, action at the row's end, all on one line from sm. On a phone the
 * label sits over the value and the action stays at the right. A faint inset fill on hover shows the row's extent.
 */
export const PANEL_ROW = "flex min-h-10 min-w-0 items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-950/60"
export const PANEL_ROW_TEXT = "min-w-0 flex-1 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center sm:gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]"
export const PANEL_ROW_LABEL = "text-sm text-neutral-500 dark:text-neutral-400"
export const PANEL_ROW_VALUE = "min-w-0 text-sm text-neutral-900 dark:text-white"

/**
 * A compact 32px control for a row's end; the 6px `after:` expansion makes it a 44px target without overlapping the
 * next row.
 */
export const PANEL_ROW_ACTION =
    "relative inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-neutral-100 px-2.5 text-sm font-medium text-neutral-800 transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"

/**
 * `onActivate` makes the WHOLE row open what its end button opens (an edit sheet): the row takes the click and carries
 * `data-sheet-keep-open`, so pressing another row swaps the sheet instead of closing it. The end button stays the
 * keyboard path, so the row itself is not a second tab stop.
 */
export function PanelRow({ label, action, children, valueClassName, onActivate, className }: {
    label: React.ReactNode
    action?: React.ReactNode
    children: React.ReactNode
    valueClassName?: string
    onActivate?: () => void
    className?: string
}) {
    return (
        <div
            className={cn(PANEL_ROW, onActivate && "cursor-pointer", className)}
            // A press on the row's own button, link or input is that control's; only the rest of the row activates.
            onClick={onActivate ? (e) => { if (!(e.target as HTMLElement).closest("button,a,input,label")) onActivate() } : undefined}
            data-sheet-keep-open={onActivate ? "" : undefined}
        >
            <div className={PANEL_ROW_TEXT}>
                <dt className={PANEL_ROW_LABEL}>{label}</dt>
                <dd className={cn(PANEL_ROW_VALUE, valueClassName)}>{children}</dd>
            </div>
            {action && <div className="flex shrink-0 items-center">{action}</div>}
        </div>
    )
}
