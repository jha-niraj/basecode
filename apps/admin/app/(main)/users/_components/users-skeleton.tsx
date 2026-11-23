import { Users } from "lucide-react"
import { FilterBarSkeleton, TableSkeleton } from "@repo/ui/components/skeleton-kit"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"

/** The Users page while it loads: header, the four-cell band, the toolbar and the grid. */
export function UsersSkeleton() {
    return (
        <PageSkeleton title="Users" description="Everyone with an account. Press a row to see the details." icon={<Users />}>
            <StatBandSkeleton count={4} />
            <FilterBarSkeleton filters={2} inCard={false} />
            <TableSkeleton rows={8} cols={5} withAvatar withPagination />
        </PageSkeleton>
    )
}
