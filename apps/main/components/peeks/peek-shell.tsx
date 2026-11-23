'use client'

import type { ReactNode } from 'react'
import { ScrollArea } from '@repo/ui/components/ui/scroll-area'
import { Skeleton } from '@repo/ui/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@repo/ui/components/ui/avatar'

/**
 * The quick-look layout: a header (title, subtitle, avatar), a scrolling body of label/value rows, and a footer that is
 * ALWAYS one row (buttons shrink and truncate; a project with more than two or three actions moves the rest into one
 * More menu). The skeleton shares the class constants, so nothing jumps when the data lands.
 */

const HEAD = 'flex min-w-0 shrink-0 items-center gap-3 px-4 pb-3 pt-4'
const ROW = 'flex min-w-0 items-center justify-between gap-3 py-2'
const FOOT = 'flex min-w-0 shrink-0 flex-nowrap items-center gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800'

export function PeekShell({ title, subtitle, image, stats, footer, children }: {
    title: string
    subtitle?: string
    image?: string | null
    stats?: { label: string; value: string }[]
    footer?: ReactNode
    children?: ReactNode
}) {
    const initials = title.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={HEAD}>
                {image !== undefined && (
                    <Avatar className="h-10 w-10 shrink-0">
                        {image ? <AvatarImage src={image} alt="" /> : null}
                        <AvatarFallback className="text-xs">{initials || '?'}</AvatarFallback>
                    </Avatar>
                )}
                <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-neutral-900 dark:text-white">{title}</p>
                    {subtitle && <p className="truncate text-xs text-neutral-600 dark:text-neutral-400">{subtitle}</p>}
                </div>
            </div>
            <ScrollArea orientation="vertical" className="min-h-0 flex-1">
                <div className="min-w-0 divide-y divide-neutral-100 px-4 dark:divide-neutral-900">
                    {stats?.map((s) => (
                        <div key={s.label} className={ROW}>
                            <span className="min-w-0 truncate text-sm text-neutral-600 dark:text-neutral-400">{s.label}</span>
                            <span className="shrink-0 text-sm font-medium text-neutral-900 dark:text-neutral-100">{s.value}</span>
                        </div>
                    ))}
                </div>
                {children}
            </ScrollArea>
            {footer && <div className={FOOT}>{footer}</div>}
        </div>
    )
}

export function PeekShellSkeleton({ rows = 4, withImage, children }: { rows?: number; withImage?: boolean; children?: ReactNode }) {
    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className={HEAD}>
                {withImage && <Skeleton className="h-10 w-10 shrink-0 rounded-full" />}
                <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-5 w-40 rounded" />
                    <Skeleton className="h-3 w-52 rounded" />
                </div>
            </div>
            <div className="min-h-0 flex-1 divide-y divide-neutral-100 px-4 dark:divide-neutral-900">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className={ROW}>
                        <Skeleton className="h-3.5 w-32 rounded" delay={i * 0.05} />
                        <Skeleton className="h-3.5 w-16 rounded" delay={i * 0.05} />
                    </div>
                ))}
            </div>
            {children && <div className={FOOT}>{children}</div>}
        </div>
    )
}
