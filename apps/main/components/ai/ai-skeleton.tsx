import { Skeleton } from '@repo/ui/components/ui/skeleton'
import { PageSkeleton } from '@repo/ui/components/ui/page'
import { cn } from '@repo/ui/lib/utils'
import { CHAT_COLUMN, CHAT_COLUMN_STYLE, READING_MEASURE } from './query-keys'

/**
 * Skeletons for the AI page. The transcript skeleton sits in the SAME reading measure as the transcript, so the page
 * never narrows when messages land. `AiPageSkeleton` is loading.tsx's and mirrors the page: the chat column (Page
 * header + transcript + composer) and, from lg, the right column.
 */

export function TranscriptSkeleton() {
    return (
        <div className={cn('mx-auto flex w-full min-w-0 flex-col gap-6 px-3 py-6 sm:px-6', READING_MEASURE)}>
            {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="flex flex-col gap-3">
                    <div className="flex justify-end"><Skeleton className="h-9 w-2/5 rounded-2xl" delay={i * 0.1} /></div>
                    <div className="space-y-2">
                        <Skeleton className="h-3.5 w-11/12 rounded" delay={i * 0.1} />
                        <Skeleton className="h-3.5 w-4/5 rounded" delay={i * 0.1} />
                        <Skeleton className="h-3.5 w-2/3 rounded" delay={i * 0.1} />
                    </div>
                </div>
            ))}
        </div>
    )
}

export function ComposerSkeleton() {
    return (
        <div className={cn('mx-auto w-full min-w-0 px-3 pb-3', READING_MEASURE)}>
            <Skeleton className="h-[92px] w-full rounded-2xl" />
            <div className="mt-1.5 hidden h-5 sm:block" />
        </div>
    )
}

export function AiPageSkeleton({ title }: { title: string }) {
    return (
        <div className="flex h-[var(--app-page-h)] min-h-0 w-full min-w-0">
            <div className={CHAT_COLUMN} style={CHAT_COLUMN_STYLE}>
                <PageSkeleton title={title} icon={false} description={false} actions={3} primaryAction bleed body="fill" className="[&>[data-page-header]]:px-4">
                    <div className="relative flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1 overflow-hidden"><TranscriptSkeleton /></div>
                        <ComposerSkeleton />
                    </div>
                </PageSkeleton>
            </div>
            <div className="hidden h-full w-[clamp(300px,calc(100vw-1024px),560px)] shrink-0 flex-col gap-3 bg-white p-3 shadow-[-12px_0_28px_-18px_rgb(0_0_0/0.22)] lg:flex dark:bg-neutral-950">
                <Skeleton className="h-8 w-44 rounded-xl" />
                {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" delay={i * 0.05} />)}
            </div>
        </div>
    )
}
