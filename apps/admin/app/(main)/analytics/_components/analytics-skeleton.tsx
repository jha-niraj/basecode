import { BarChart3 } from "lucide-react"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"
import { ChartCardSkeleton } from "@repo/ui/components/skeleton-kit"

export function AnalyticsSkeleton() {
    return (
        <PageSkeleton title="Analytics" icon={<BarChart3 />} body="page">
            <StatBandSkeleton count={5} />
            <ChartCardSkeleton height={220} />
        </PageSkeleton>
    )
}
