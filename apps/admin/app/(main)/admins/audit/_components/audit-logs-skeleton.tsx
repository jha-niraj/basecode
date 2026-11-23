import { Activity } from "lucide-react"
import { PageSkeleton } from "@repo/ui/components/ui/page"
import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { TableSkeleton } from "@repo/ui/components/skeleton-kit"

/** The audit log's loading state: header with the window picker, the toolbar row, the grid. */
export function AuditLogsSkeleton({ rowsOnly = false }: { rowsOnly?: boolean }) {
    const body = (
        <>
            <div className="flex min-w-0 items-center gap-2">
                <Skeleton className="h-9 w-full max-w-xs rounded-xl" />
                <Skeleton className="h-8 w-28 shrink-0 rounded-xl" />
                <Skeleton className="ml-auto h-8 w-24 shrink-0 rounded-xl" />
            </div>
            <Skeleton className="h-3.5 w-48 rounded" />
            <TableSkeleton rows={8} cols={6} />
        </>
    )
    if (rowsOnly) return body
    return (
        <PageSkeleton title="Audit log" icon={<Activity />} description="Every admin action, newest first. Kept for 90 days." extra="w-[150px] sm:w-[170px]">
            {body}
        </PageSkeleton>
    )
}
