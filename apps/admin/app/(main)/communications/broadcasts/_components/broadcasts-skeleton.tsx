import { Radio } from "lucide-react"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"
import { TableSkeleton } from "@repo/ui/components/skeleton-kit"

export function BroadcastsSkeleton() {
    return (
        <PageSkeleton title="Broadcasts" icon={<Radio />} description="Email messages written for every user" tabs={3} actions={1} primaryAction>
            <StatBandSkeleton count={3} />
            <Skeleton className="h-9 w-full max-w-sm rounded-xl" />
            <TableSkeleton rows={6} cols={5} />
        </PageSkeleton>
    )
}
