import { PageSkeleton } from "@repo/ui/components/ui/page"
import { Skeleton } from "@repo/ui/components/ui/skeleton"

const CARD = "rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900"

/** Shortcuts (2 rows), questions (5 rows), the contact form. */
export default function Loading() {
    return (
        <PageSkeleton width="reading" title="Help" description="Shortcuts, answers and a way to reach us." icon={false}>
            <div className="flex w-full flex-col gap-3">
                <div className={CARD}>
                    <Skeleton className="h-5 w-40 rounded" />
                    <div className="mt-4 space-y-3">
                        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-5 w-full rounded" />)}
                    </div>
                </div>
                <div className={CARD}>
                    <Skeleton className="h-5 w-28 rounded" />
                    <div className="mt-4 space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded" delay={i * 0.05} />)}
                    </div>
                </div>
                <div className={CARD}>
                    <Skeleton className="h-5 w-28 rounded" />
                    <Skeleton className="mt-1.5 h-3.5 w-56 rounded" />
                    <div className="mt-4 space-y-4">
                        <Skeleton className="h-9 w-full rounded-xl" />
                        <Skeleton className="h-28 w-full rounded-xl" />
                    </div>
                </div>
            </div>
        </PageSkeleton>
    )
}
