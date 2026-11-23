import { Settings } from "lucide-react"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { PANEL } from "@repo/ui/components/ui/section-panel"
import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"

export function SettingsSkeleton() {
    return (
        <PageSkeleton title="Settings" icon={<Settings />} description="Platform configuration and health" extra="w-10 sm:w-[124px]">
            <StatBandSkeleton count={3} />
            <div className={PANEL}>
                <Skeleton className="h-4 w-40 rounded" />
                <div className="mt-3 flex flex-col gap-4">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="flex items-center justify-between gap-4">
                            <div className="min-w-0 flex-1 space-y-1.5">
                                <Skeleton className="h-4 w-40 rounded" />
                                <Skeleton className="h-3 w-64 max-w-full rounded" />
                            </div>
                            <Skeleton className="h-9 w-44 rounded-xl" />
                        </div>
                    ))}
                </div>
            </div>
        </PageSkeleton>
    )
}
