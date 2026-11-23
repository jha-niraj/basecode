import { Receipt } from "lucide-react"
import { FilterBarSkeleton, TableSkeleton } from "@repo/ui/components/skeleton-kit"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"

export const BILLING_TITLE = "Billing"
export const BILLING_DESCRIPTION = "Payments, subscriptions and credit grants."

/** Header (two tabs, one action), the four-cell band, the toolbar and the table. */
export function BillingSkeleton() {
    return (
        <PageSkeleton title={BILLING_TITLE} description={BILLING_DESCRIPTION} icon={<Receipt />} tabs={2} actions={1} primaryAction>
            <StatBandSkeleton count={4} />
            <FilterBarSkeleton filters={2} inCard={false} />
            <TableSkeleton rows={8} cols={6} withPagination />
        </PageSkeleton>
    )
}
