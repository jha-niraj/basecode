import { Skeleton } from "@repo/ui/components/ui/skeleton"

/** The list card and the pagination bar under it - loading.tsx and the client's first load share this. */
export function NotificationsListSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <div className="flex min-w-0 flex-col gap-3">
            <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3.5">
                        <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-full" delay={i * 0.05} />
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-48 max-w-full rounded" delay={i * 0.05} />
                            <Skeleton className="h-3.5 w-80 max-w-full rounded" delay={i * 0.05} />
                            <Skeleton className="h-3 w-16 rounded" delay={i * 0.05} />
                        </div>
                        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    </div>
                ))}
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
        </div>
    )
}
