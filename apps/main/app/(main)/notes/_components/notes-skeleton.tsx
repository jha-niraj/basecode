import { NotebookPen } from "lucide-react"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"

/** The header's static copy - ONE constant, so the page and its skeleton can never say different things. */
export const NOTES_TITLE = "Notes"
export const NOTES_DESCRIPTION = "Everything you have written down. Press a note to open it."

/** Grid geometry the real grid and this skeleton share (a list ceiling of about 10 rows). */
export const NOTES_GRID = { rowH: 52, headH: 41, maxH: 560 } as const

/**
 * The Notes page while it loads - drawn to the exact layout: the real title and description, two tabs and one primary
 * action in the header, the four-cell band, the chart panel, the toolbar, the bounded grid and the pager. Grey only
 * where data goes. `loading.tsx` and the client's loading branch both render THIS, so the two can never drift.
 *
 * After any layout change in `notes-client.tsx`, re-read this file and diff the classes - nothing warns you.
 */
export function NotesSkeleton() {
    return (
        <PageSkeleton title={NOTES_TITLE} description={NOTES_DESCRIPTION} icon={<NotebookPen />} tabs={2} actions={1} primaryAction>
            <StatBandSkeleton count={4} />

            {/* ChartPanel: rounded-2xl border p-4, a title and hint row, a 176px chart. */}
            <div className="flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card p-4">
                <div className="mb-2 space-y-1.5">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-3 w-44 rounded" />
                </div>
                <Skeleton className="h-[176px] w-full rounded-lg" />
            </div>

            <div className="flex min-w-0 flex-col gap-3">
                {/* Toolbar: search, the filter chips (from sm), exports on the right; one menu button on a phone. */}
                <div className="flex min-w-0 items-center gap-2">
                    <Skeleton className="h-9 min-w-0 flex-1 rounded-xl sm:max-w-xs sm:flex-none sm:basis-80" />
                    <Skeleton className="hidden h-8 w-24 rounded-xl sm:block" />
                    <div className="ml-auto hidden items-center gap-2 sm:flex">
                        <Skeleton className="h-8 w-28 rounded-xl" />
                        <Skeleton className="h-8 w-24 rounded-xl" />
                    </div>
                    <Skeleton className="h-8 w-10 shrink-0 rounded-xl sm:hidden" />
                </div>

                {/* The grid: header row plus eight rows, inside the same ring as the real one. */}
                <div className="overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-800">
                    <div className="flex items-center gap-4 border-b border-neutral-200 px-4 dark:border-neutral-800" style={{ height: NOTES_GRID.headH }}>
                        <Skeleton className="h-3 w-4 rounded" />
                        <Skeleton className="h-3 w-16 rounded" />
                        <Skeleton className="ml-auto hidden h-3 w-12 rounded sm:block" />
                        <Skeleton className="hidden h-3 w-14 rounded sm:block" />
                        <Skeleton className="hidden h-3 w-14 rounded md:block" />
                    </div>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 last:border-b-0 dark:border-neutral-800/60" style={{ height: NOTES_GRID.rowH }}>
                            <Skeleton className="h-4 w-4 shrink-0 rounded" />
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <Skeleton className="h-3.5 w-48 max-w-full rounded" />
                                <Skeleton className="h-3 w-72 max-w-full rounded" />
                            </div>
                            <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
                            <Skeleton className="hidden h-3 w-20 rounded sm:block" />
                            <Skeleton className="hidden h-3 w-20 rounded md:block" />
                            <Skeleton className="h-8 w-24 shrink-0 rounded-xl" />
                        </div>
                    ))}
                </div>

                {/* ListPagination (card): count on the left, the pager on the right. */}
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
                    <Skeleton className="h-3.5 w-32 rounded" />
                    <div className="flex gap-2">
                        <Skeleton className="h-8 w-20 rounded-xl" />
                        <Skeleton className="h-8 w-20 rounded-xl" />
                    </div>
                </div>
            </div>
        </PageSkeleton>
    )
}
