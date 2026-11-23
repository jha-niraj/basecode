"use client"

import * as React from "react"
import { ListFilter } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { ChoiceChips, type ChoiceChip } from "./choice-chips"
import { ScrollArea } from "./scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "./sheet"

/**
 * Filters that do not fit a toolbar - a "Filters" button with a count that opens a right sheet, each group a wrap of
 * pill chips (clean controls, Niraj 2026-11-23: Studio's filter menu ran off the screen with a long subject list).
 * The list behind updates as a chip is pressed - no Apply step; Done only closes. Use it when a page has 2+ filter
 * groups or one long one; one short group belongs in the toolbar as ChoiceChips.
 */
export interface FilterSheetGroup {
    key: string
    label: string
    value: string
    options: ChoiceChip<string>[]
    onChange: (value: string) => void
    /** Leave it out to hide the group (e.g. a school-only filter for an independent learner). */
    hidden?: boolean
}

export function FilterSheet({
    groups,
    activeCount,
    onClear,
    title = "Filters",
    description,
    className,
}: {
    groups: FilterSheetGroup[]
    /** How many groups are off their default - drawn as a count on the button. */
    activeCount: number
    onClear: () => void
    title?: string
    description?: string
    className?: string
}) {
    const [open, setOpen] = React.useState(false)
    const shown = groups.filter((g) => !g.hidden)
    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    data-sheet-keep-open=""
                    aria-label={activeCount > 0 ? `${title}, ${activeCount} on` : title}
                    className={cn("h-9 shrink-0 gap-1.5 px-3 [&_svg]:size-4", activeCount > 0 && "text-neutral-900 dark:text-neutral-50", className)}
                >
                    <ListFilter aria-hidden className="text-neutral-500 dark:text-neutral-400" />
                    <span className="hidden sm:inline">{title}</span>
                    {activeCount > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1.5 text-xs font-semibold tabular-nums text-white dark:bg-white dark:text-neutral-900">
                            {activeCount}
                        </span>
                    ) : null}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                    {description ? <SheetDescription>{description}</SheetDescription> : null}
                </SheetHeader>
                <ScrollArea orientation="vertical" className="-mx-6 min-h-0 flex-1 px-6">
                    <div className="flex flex-col gap-6 pb-2">
                        {shown.map((g) => (
                            <section key={g.key} className="flex flex-col gap-2.5">
                                <h3 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{g.label}</h3>
                                <ChoiceChips
                                    label={g.label}
                                    options={g.options}
                                    value={g.value}
                                    onChange={g.onChange}
                                    collapseAfter={Number.POSITIVE_INFINITY}
                                    collapseOnPhone={false}
                                />
                            </section>
                        ))}
                    </div>
                </ScrollArea>
                <SheetFooter className="flex-row justify-between sm:justify-between">
                    <Button type="button" variant="ghost" onClick={onClear} disabled={activeCount === 0}>Clear all</Button>
                    <Button type="button" onClick={() => setOpen(false)}>Done</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
