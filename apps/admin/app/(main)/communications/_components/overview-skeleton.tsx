import { MessageSquare } from "lucide-react"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { PANEL } from "@repo/ui/components/ui/section-panel"
import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"

export function OverviewSkeleton() {
    return (
        <PageSkeleton title="Communications" icon={<MessageSquare />} description="Announcements in the app and email broadcasts" actions={2} primaryAction body="page">
            <StatBandSkeleton count={4} />
            <div className={PANEL}>
                <Skeleton className="h-4 w-28 rounded" />
                <div className="mt-3 flex flex-col gap-3">
                    {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
                </div>
            </div>
        </PageSkeleton>
    )
}
