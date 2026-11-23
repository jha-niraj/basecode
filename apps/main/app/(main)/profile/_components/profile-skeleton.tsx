import { Skeleton } from "@repo/ui/components/ui/skeleton"

/** The Profile tab's shape: the photo card, then the details card (name, bio, footer button). */
export function ProfileSkeleton() {
    return (
        <div className="flex w-full flex-col gap-3">
            <div className="rounded-2xl border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800">
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="mt-1.5 h-3 w-56 rounded-md" />
                <div className="mt-4 flex items-center gap-4">
                    <Skeleton className="size-16 rounded-full" />
                    <Skeleton className="h-9 w-32 rounded-xl" />
                </div>
            </div>
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800">
                <div className="space-y-4 p-4 sm:p-5">
                    <Skeleton className="h-5 w-20 rounded-md" />
                    <div className="space-y-1.5"><Skeleton className="h-4 w-16 rounded-md" /><Skeleton className="h-10 w-full rounded-xl" /></div>
                    <div className="space-y-1.5"><Skeleton className="h-4 w-16 rounded-md" /><Skeleton className="h-10 w-full rounded-xl" /></div>
                    <div className="space-y-1.5"><Skeleton className="h-4 w-12 rounded-md" /><Skeleton className="h-20 w-full rounded-xl" /></div>
                </div>
                <div className="flex justify-end border-t border-neutral-200 px-4 py-3 sm:px-5 dark:border-neutral-800">
                    <Skeleton className="h-9 w-28 rounded-xl" />
                </div>
            </div>
        </div>
    )
}
