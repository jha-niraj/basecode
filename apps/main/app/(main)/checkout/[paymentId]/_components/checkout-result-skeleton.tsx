import { PageSkeleton } from "@repo/ui/components/ui/page"
import { Skeleton } from "@repo/ui/components/ui/skeleton"

export const RESULT_TITLE = "Payment"
export const RESULT_DESCRIPTION = "What happened to your payment."

/** The result card's shape: icon, a sentence, two detail rows, two buttons. */
export function ResultCardSkeleton() {
    return (
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 rounded-xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:bg-neutral-900">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-4 w-64 rounded-md" />
            <Skeleton className="mt-2 h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <div className="mt-2 flex gap-2"><Skeleton className="h-9 w-28 rounded-xl" /><Skeleton className="h-9 w-28 rounded-xl" /></div>
        </div>
    )
}

export function CheckoutResultSkeleton() {
    return (
        <PageSkeleton title={RESULT_TITLE} description={RESULT_DESCRIPTION} back body="page">
            <ResultCardSkeleton />
        </PageSkeleton>
    )
}
