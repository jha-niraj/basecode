import { FlowStepsSkeleton } from "@repo/ui/components/ui/flow-steps"
import { Skeleton } from "@repo/ui/components/ui/skeleton"

/** The welcome card's shape: the step strip, the first step's photo row and name field, the Back / Next band. */
export default function Loading() {
    return (
        <section role="status" aria-busy="true" className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
                <FlowStepsSkeleton count={4} size="sm" />
            </div>
            <div className="min-h-[18rem] space-y-5 px-5 py-5">
                <div className="space-y-1.5">
                    <Skeleton className="h-7 w-56 rounded" />
                    <Skeleton className="h-4 w-72 max-w-full rounded" />
                </div>
                <div className="flex items-center gap-4">
                    <Skeleton className="size-16 rounded-full" />
                    <Skeleton className="h-9 w-32 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-9 w-full rounded-xl" />
                </div>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
                <Skeleton className="h-9 w-20 rounded-xl" />
                <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
        </section>
    )
}
