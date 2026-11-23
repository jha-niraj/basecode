import { Home } from "lucide-react"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"
import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { PANEL } from "@repo/ui/components/ui/section-panel"

/** Home's loading state - the same header, band and two panels as the page. Shared by loading.tsx and the client. */
export function HomeSkeleton() {
    return (
        <PageSkeleton title="Home" icon={<Home />} body="page">
            <StatBandSkeleton count={4} />
            <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className={PANEL}>
                    <Skeleton className="h-4 w-32 rounded" />
                    <div className="mt-3 flex flex-col gap-3">
                        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
                    </div>
                </div>
                <div className={PANEL}>
                    <Skeleton className="h-4 w-24 rounded" />
                    <div className="mt-3 flex flex-col gap-2">
                        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                    </div>
                </div>
            </div>
        </PageSkeleton>
    )
}
