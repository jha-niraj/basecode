'use client'

import { Suspense, type ComponentType, type ReactNode } from 'react'
import { parsePeekHref, isPeekHref, type PeekKind } from '@/lib/peeks/peek-routes'
import { usePeekStore } from '@/stores/peek.store'
import { PeekShell } from './peek-shell'
import { UserPeekBody, UserPeekSkeleton } from './bodies/user-peek'

/**
 * kind -> { title, body, skeleton }. A project adds a kind here and in lib/peeks/peek-routes.ts.
 * Each body starts its own read (a server action that checks the session) and reads it with `use()`.
 */
const REGISTRY: Record<PeekKind, { title: string; Body: ComponentType<{ id: string }>; Skeleton: ComponentType }> = {
    user: { title: 'Person', Body: UserPeekBody, Skeleton: UserPeekSkeleton },
}

export function peekTitle(href: string): string {
    const a = parsePeekHref(href)
    return a ? REGISTRY[a.kind].title : 'Quick look'
}

/** Click capture inside a peek: a `/peek/` link stacks the next peek in place instead of navigating. */
function PeekLinks({ children }: { children: ReactNode }) {
    const open = usePeekStore((s) => s.open)
    return (
        <div
            data-peek-links
            className="flex min-h-0 flex-1 flex-col"
            onClickCapture={(e) => {
                if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                const a = (e.target as HTMLElement).closest('a')
                const href = a?.getAttribute('href')
                if (!href || !isPeekHref(href) || a?.target === '_blank') return
                e.preventDefault()
                open(href)
            }}
        >
            {children}
        </div>
    )
}

/** The top of the peek stack, drawn in whichever host shows it (the right column, or the phone's bottom sheet). */
export function PeekBody({ href }: { href: string }) {
    const a = parsePeekHref(href)
    if (!a) return <PeekShell title="Quick look" subtitle="This link cannot be opened here." />
    const { Body, Skeleton } = REGISTRY[a.kind]
    return (
        <PeekLinks>
            <Suspense key={href} fallback={<Skeleton />}>
                <Body id={a.id} />
            </Suspense>
        </PeekLinks>
    )
}
