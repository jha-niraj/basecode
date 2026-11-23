import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { StatBandSkeleton } from "@repo/ui/components/ui/stat-band"
import { cn } from "@repo/ui/lib/utils"

/**
 * The section bodies' loading shapes - each loading.tsx and nothing else uses these, so a layout edit to a section is
 * diffed against ONE skeleton here.
 */

const CARD = "rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900"

function SectionHead() {
    return (
        <div className="space-y-1.5">
            <Skeleton className="h-5 w-40 rounded" />
            <Skeleton className="h-3.5 w-64 max-w-full rounded" />
        </div>
    )
}

/** A Section (profile/_components/section) of `rows` divider rows with a control on the right. */
export function SectionRowsSkeleton({ rows = 4, controls = 1, className }: { rows?: number; controls?: number; className?: string }) {
    return (
        <div className={cn(CARD, className)}>
            <SectionHead />
            <div className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-800">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-36 rounded" delay={i * 0.05} />
                            <Skeleton className="h-3 w-56 max-w-full rounded" delay={i * 0.05} />
                        </div>
                        <div className="flex shrink-0 gap-6">
                            {Array.from({ length: controls }).map((__, j) => <Skeleton key={j} className="h-5 w-9 rounded-full" />)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function NotificationsSettingsSkeleton() {
    return (
        <div className="flex w-full flex-col gap-3">
            <SectionRowsSkeleton rows={4} controls={2} />
        </div>
    )
}

export function AppearanceSkeleton() {
    return (
        <div className="flex w-full flex-col gap-3">
            <div className={CARD}>
                <SectionHead />
                <div className="mt-4 grid grid-cols-3 gap-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
            </div>
            <SectionRowsSkeleton rows={2} />
        </div>
    )
}

export function AccountsSkeleton() {
    return (
        <div className="flex w-full flex-col gap-3">
            <SectionRowsSkeleton rows={3} />
        </div>
    )
}

export function UsageSkeleton() {
    return (
        <div className="flex min-w-0 flex-col gap-4">
            <StatBandSkeleton count={4} />
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <Skeleton className="h-4 w-40 rounded" />
                <Skeleton className="mt-1.5 h-3 w-56 rounded" />
                <Skeleton className="mt-3 h-[200px] w-full rounded-xl" />
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <Skeleton className="h-4 w-32 rounded" />
                <div className="mt-3 space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" delay={i * 0.05} />)}
                </div>
            </div>
        </div>
    )
}
