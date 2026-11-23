'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { Button } from '@repo/ui/components/ui/button'
import { ScrollArea } from '@repo/ui/components/ui/scroll-area'
import { Skeleton } from '@repo/ui/components/ui/skeleton'
import { AppLink } from '@repo/ui/components/app-link'
import { getNeedsYou } from '@/actions/ai/ai.action'
import type { NeedsYouGroup, NeedsYouItem, NeedsYouList } from '@/lib/ai/types'
import { isPeekHref } from '@/lib/peeks/peek-routes'
import { AI_NEEDS_YOU_KEY } from './query-keys'

/**
 * Needs you - the resting tab. ONE free read (no model call, no AI cost). "You're clear for now" only when no source
 * failed; a failed source says so with Try again. Nothing to do is one line, never an empty group or a zero.
 */

async function fetchNeedsYou(): Promise<NeedsYouList> {
    const res = await getNeedsYou()
    if (!res.success) throw new Error(res.error ?? 'Could not load the list.')
    return res.data
}

const GROUPS: { id: NeedsYouGroup; label: string }[] = [
    { id: 'now', label: 'Now' },
    { id: 'today', label: 'Today' },
    { id: 'later', label: 'When you have a moment' },
]

export function NeedsYouFromPromise({ promise, onOpenPeek }: { promise: Promise<NeedsYouList>; onOpenPeek: (href: string) => void }) {
    const initial = use(promise)
    return <NeedsYou initial={initial} onOpenPeek={onOpenPeek} />
}

export function NeedsYou({ initial, onOpenPeek }: { initial: NeedsYouList; onOpenPeek: (href: string) => void }) {
    const { data, isError, refetch, isFetching } = useQuery({ queryKey: AI_NEEDS_YOU_KEY, queryFn: fetchNeedsYou, initialData: initial })
    const count = data.items.length
    const failedLine = isError ? ['this list'] : data.failed

    return (
        <ScrollArea orientation="vertical" className="min-h-0 flex-1">
            <div className="flex min-w-0 flex-col gap-4 p-3">
                <p className="px-1 text-sm text-neutral-800 dark:text-neutral-200">
                    {count > 0 ? `${count} ${count === 1 ? 'thing needs' : 'things need'} you` : failedLine.length ? 'Some of this list could not be read.' : 'You\'re clear for now.'}
                </p>
                {failedLine.length > 0 && (
                    <p className="px-1 text-xs text-neutral-700 dark:text-neutral-300">
                        Could not read {failedLine.join(', ')}.{' '}
                        <Button variant="link" size="sm" disabled={isFetching} className="h-auto cursor-pointer p-0 text-xs" onClick={() => void refetch()}>Try again</Button>
                    </p>
                )}
                {GROUPS.map((g) => {
                    const rows = data.items.filter((i) => i.group === g.id)
                    if (!rows.length) return null
                    return (
                        <div key={g.id} className="min-w-0">
                            <p className="mb-1 px-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">{g.label}</p>
                            <div className="flex min-w-0 flex-col divide-y divide-neutral-100 dark:divide-neutral-900">
                                {rows.map((r) => <Row key={r.id} item={r} onOpenPeek={onOpenPeek} />)}
                            </div>
                        </div>
                    )
                })}
            </div>
        </ScrollArea>
    )
}

function Row({ item, onOpenPeek }: { item: NeedsYouItem; onOpenPeek: (href: string) => void }) {
    const inner = (
        <>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-neutral-900 dark:text-neutral-100">{item.title}</span>
                <span className="block truncate text-xs font-normal text-neutral-600 dark:text-neutral-400">{item.detail}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
        </>
    )
    const cls = 'h-auto w-full min-w-0 cursor-pointer justify-start gap-2 rounded-lg px-2 py-2 text-left font-normal'
    if (item.href && isPeekHref(item.href)) {
        return <Button type="button" variant="ghost" className={cls} onClick={() => onOpenPeek(item.href!)} data-sheet-keep-open>{inner}</Button>
    }
    if (item.href) return <Button asChild variant="ghost" className={cls}><AppLink href={item.href}>{inner}</AppLink></Button>
    return <div className="flex min-w-0 items-center gap-2 px-2 py-2">{inner}</div>
}

export function NeedsYouSkeleton() {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-12 rounded" />
            {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="space-y-1.5 px-2 py-1">
                    <Skeleton className="h-3.5 w-1/2 rounded" delay={i * 0.05} />
                    <Skeleton className="h-3 w-3/4 rounded" delay={i * 0.05} />
                </div>
            ))}
        </div>
    )
}
