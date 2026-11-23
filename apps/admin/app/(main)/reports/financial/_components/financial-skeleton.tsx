import { Wallet } from "lucide-react"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"
import { ChartCardSkeleton, TableSkeleton } from "@repo/ui/components/skeleton-kit"

export function FinancialSkeleton() {
    return (
        <PageSkeleton title="Financial report" icon={<Wallet />} description="Payments received and AI spend, in UTC days" body="page">
            <StatBandSkeleton count={5} />
            <ChartCardSkeleton height={200} />
            <TableSkeleton rows={5} cols={5} />
        </PageSkeleton>
    )
}
