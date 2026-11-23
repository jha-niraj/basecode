import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"

/** /home's body: the band, the chart beside the activity list, the quick links. */
export function HomeSkeleton() {
    return (
        <>
            <StatBandSkeleton count={4} />
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="mt-1.5 h-3 w-44 rounded" />
                    <Skeleton className="mt-3 h-[220px] w-full rounded-xl" />
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="mt-1.5 h-3 w-40 rounded" />
                    <div className="mt-3 space-y-1">
                        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" delay={i * 0.05} />)}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
        </>
    )
}
