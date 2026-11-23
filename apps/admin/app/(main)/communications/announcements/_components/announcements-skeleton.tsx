import { Megaphone } from "lucide-react"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"
import { TableSkeleton } from "@repo/ui/components/skeleton-kit"

export function AnnouncementsSkeleton() {
    return (
        <PageSkeleton title="Announcements" icon={<Megaphone />} description="Messages shown to everyone in the app" tabs={4} actions={1} primaryAction>
            <StatBandSkeleton count={3} />
            <Skeleton className="h-9 w-full max-w-sm rounded-xl" />
            <TableSkeleton rows={6} cols={5} />
        </PageSkeleton>
    )
}
