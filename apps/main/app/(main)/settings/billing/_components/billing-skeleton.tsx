import { TableSkeleton } from "@repo/ui/components/skeleton-kit"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"

export const BILLING_TITLE = "Billing"
export const BILLING_DESCRIPTION = "Your plan, credits and payments."

/** One panel's shape: heading, a line, then rows. */
function PanelShape({ rows }: { rows: number }) {
    return (
        <div className="min-w-0 rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:px-4 sm:py-3.5 dark:bg-neutral-900">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="mt-1.5 h-3 w-56 rounded-md" />
            <div className="mt-3 flex flex-col gap-2">
                {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
            </div>
        </div>
    )
}

/** The billing body while it loads: the four-cell band, the plan and credits panels side by side, the payments table. */
export function BillingBodySkeleton() {
    return (
        <div className="flex min-w-0 flex-col gap-4">
            <StatBandSkeleton count={4} />
            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                <PanelShape rows={4} />
                <PanelShape rows={4} />
            </div>
            <TableSkeleton rows={5} cols={5} />
        </div>
    )
}

export function BillingSkeleton() {
    return (
        <PageSkeleton title={BILLING_TITLE} description={BILLING_DESCRIPTION} extra="w-40" body="page">
            <BillingBodySkeleton />
        </PageSkeleton>
    )
}
