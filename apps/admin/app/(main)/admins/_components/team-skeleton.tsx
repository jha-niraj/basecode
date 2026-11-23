import { Shield } from "lucide-react"
import { TableSkeleton } from "@repo/ui/components/skeleton-kit"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"

/** The Admins page while it loads - same header (title, two tabs, one primary action), band and table. */
export function TeamSkeleton() {
    return (
        <PageSkeleton
            title="Admins"
            description="Who can use this console, and the invitations still waiting."
            icon={<Shield />}
            tabs={2}
            actions={1}
            primaryAction
        >
            <StatBandSkeleton count={4} />
            <TableSkeleton rows={6} cols={5} withAvatar />
        </PageSkeleton>
    )
}
