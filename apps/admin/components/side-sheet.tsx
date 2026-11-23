"use client"

import * as React from "react"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet"
import { cn } from "@repo/ui/lib/utils"

/**
 * The console's right-hand sheet for viewing or editing ONE list item (AGENTS.md "Sheets"): non-modal, a header band,
 * a body that scrolls on its own (vertical only) and a footer band that never scrolls away. With `onSubmit` the body
 * and footer sit inside one `<form>`, so Save stays in reach and Enter submits.
 *
 * Rows that open it carry `data-sheet-keep-open`, so pressing another row swaps the sheet instead of closing it.
 * Reset the draft in `onExitComplete`, never in `onOpenChange(false)` (the content would blank while sliding out).
 */
export function SideSheet({
    open, onOpenChange, onExitComplete, title, description, headerExtra, footer, onSubmit, size = "md", children, bodyClassName,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onExitComplete?: () => void
    title: React.ReactNode
    description?: React.ReactNode
    headerExtra?: React.ReactNode
    footer?: React.ReactNode
    onSubmit?: () => void
    size?: "md" | "lg"
    children: React.ReactNode
    bodyClassName?: string
}) {
    const body = (
        <ScrollArea orientation="vertical" className="min-h-0 flex-1">
            <div className={cn("flex min-w-0 flex-col gap-4 px-6 pb-6 pt-4", bodyClassName)}>{children}</div>
        </ScrollArea>
    )
    const foot = footer ? (
        <SheetFooter className="mt-0 border-t border-neutral-200 px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-neutral-800">
            {footer}
        </SheetFooter>
    ) : null
    return (
        <Sheet open={open} onOpenChange={onOpenChange} onExitComplete={onExitComplete}>
            <SheetContent
                side="right"
                className={cn("flex w-full flex-col gap-0 overflow-hidden p-0", size === "lg" ? "sm:max-w-2xl" : "sm:max-w-[35rem]")}
            >
                <SheetHeader className="px-6 pb-4 pt-5 pr-14">
                    <SheetTitle className="truncate">{title}</SheetTitle>
                    {description
                        ? <SheetDescription className="truncate">{description}</SheetDescription>
                        : <SheetDescription className="sr-only">{typeof title === "string" ? title : "Details"}</SheetDescription>}
                    {headerExtra}
                </SheetHeader>
                {onSubmit ? (
                    <form
                        className="flex min-h-0 flex-1 flex-col"
                        onSubmit={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onSubmit()
                        }}
                    >
                        {body}
                        {foot}
                    </form>
                ) : (
                    <>
                        {body}
                        {foot}
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}

/** A label / value row inside a detail sheet. */
export function DetailRow({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
    return (
        <div className="flex min-w-0 items-start justify-between gap-4 py-2 text-sm">
            <span className="shrink-0 text-neutral-500 dark:text-neutral-400">{label}</span>
            <span className={cn("min-w-0 break-all text-right text-neutral-900 dark:text-white", mono && "font-mono text-xs")}>{children}</span>
        </div>
    )
}
