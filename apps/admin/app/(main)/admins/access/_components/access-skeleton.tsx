import { Lock } from "lucide-react"
import { TableSkeleton } from "@repo/ui/components/skeleton-kit"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"

export function AccessSkeleton() {
    return (
        <PageSkeleton title="Access" description="Every admin's access to each area, at a glance. Press a row to change it." icon={<Lock />}>
            <StatBandSkeleton count={3} />
            <TableSkeleton rows={6} cols={7} withAvatar />
        </PageSkeleton>
    )
}
