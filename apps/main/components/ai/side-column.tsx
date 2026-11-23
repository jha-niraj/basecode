'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, X } from 'lucide-react'
import { Button } from '@repo/ui/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs'
import { cn } from '@repo/ui/lib/utils'

/**
 * THE RIGHT COLUMN of the AI page (wide screens). One thing at a time, in priority order:
 *   1. what the AI is waiting on (a question set, a confirmation, a form) - a LAYER
 *   2. a peek opened from a link - a LAYER
 *   3. the tabs: Needs you (the resting state) | History
 * A layer shows Back (to the tabs) + its title + X. It runs the full height beside the chat header, is square and
 * separated from the chat by a soft SHADOW, not a hairline (owner, 2026-11-23). Width: automatic
 * clamp(300, viewport - 1024, 560) until dragged from the left edge; the dragged width is remembered per browser and
 * a double-click on the edge goes back to automatic.
 */

export type SideTab = 'needs' | 'history'

export interface SideLayer {
    key: string
    title: string
    body: ReactNode
    onBack?: () => void
    onClose?: () => void
}

const WIDTH_KEY = 'app.ai.column-width'
const MIN = 300
const MAX = 640
/** The chat keeps at least this much, whatever the column is dragged to. */
const CHAT_MIN = 560

const autoWidth = (viewport: number) => Math.min(560, Math.max(MIN, viewport - 1024))
const fit = (width: number, viewport: number) => Math.round(Math.min(MAX, Math.max(MIN, Math.min(width, viewport - CHAT_MIN))))

function useSideColumnWidth() {
    const [viewport, setViewport] = useState(1440)
    const [dragged, setDragged] = useState<number | null>(null)
    useEffect(() => {
        try {
            const n = Number(window.localStorage.getItem(WIDTH_KEY) ?? NaN)
            if (Number.isFinite(n) && n > 0) setDragged(n)
        } catch { /* storage blocked: automatic width */ }
        const onResize = () => setViewport(window.innerWidth)
        onResize()
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])
    const set = useCallback((next: number | null) => {
        setDragged(next)
        try {
            if (next === null) window.localStorage.removeItem(WIDTH_KEY)
            else window.localStorage.setItem(WIDTH_KEY, String(Math.round(next)))
        } catch { /* not remembered */ }
    }, [])
    return { width: fit(dragged ?? autoWidth(viewport), viewport), viewport, setWidth: set }
}

export function SideColumn({
    open, tab, onTab, onClose, layer, needs, history, waiting, headerHeight,
}: {
    open: boolean
    tab: SideTab
    onTab: (tab: SideTab) => void
    onClose: () => void
    layer: SideLayer | null
    needs: ReactNode
    history: ReactNode
    /** A line over the tabs when a card waits but was stepped out of, so it is never lost. */
    waiting?: ReactNode
    /** The chat header's height, measured, so the column header ends on the same line. */
    headerHeight?: number
}) {
    const reduced = useReducedMotion()
    const { width, viewport, setWidth } = useSideColumnWidth()
    const [dragging, setDragging] = useState(false)
    const start = useRef<{ x: number; w: number } | null>(null)

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, w: width }
        setDragging(true)
    }
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!start.current) return
        // Only while the button is held: a lost pointerup must not leave the edge following the mouse.
        if ((e.buttons & 1) === 0) { start.current = null; setDragging(false); return }
        setWidth(fit(start.current.w + (start.current.x - e.clientX), viewport))
    }
    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
        start.current = null
        setDragging(false)
    }
    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); setWidth(fit(width + 24, viewport)) }
        else if (e.key === 'ArrowRight') { e.preventDefault(); setWidth(fit(width - 24, viewport)) }
    }

    // Esc steps out of a layer, else closes the column - unless a popover, menu or search took it first.
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape' || e.defaultPrevented) return
            const t = e.target as HTMLElement | null
            if (t?.closest('[role="dialog"],[role="menu"],[role="listbox"]')) return
            if (layer) (layer.onBack ?? layer.onClose)?.()
            else onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [open, layer, onClose])

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    key="side-column"
                    className="relative z-10 flex h-full min-h-0 shrink-0 overflow-hidden"
                    initial={{ width: 0 }}
                    animate={{ width }}
                    exit={{ width: 0 }}
                    transition={dragging || reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 42 }}
                >
                    <aside
                        aria-label={layer ? layer.title : tab === 'history' ? 'History' : 'Needs you'}
                        style={{ width }}
                        className="relative flex h-full min-h-0 shrink-0 flex-col bg-white shadow-[-12px_0_28px_-18px_rgb(0_0_0/0.22)] dark:bg-neutral-950 dark:shadow-[-12px_0_28px_-16px_rgb(0_0_0/0.7)]"
                        data-sheet-keep-open
                    >
                        <div
                            role="separator"
                            aria-orientation="vertical"
                            aria-label="Resize the side column"
                            aria-valuemin={MIN}
                            aria-valuemax={MAX}
                            aria-valuenow={width}
                            tabIndex={0}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerUp}
                            onDoubleClick={() => { start.current = null; setDragging(false); setWidth(null) }}
                            onKeyDown={onKeyDown}
                            className="group absolute inset-y-0 left-0 z-20 w-2 cursor-col-resize outline-none"
                        >
                            <span className={cn('absolute inset-y-0 left-0 w-0.5 bg-transparent transition-colors group-hover:bg-neutral-300 group-focus-visible:bg-amber-500 dark:group-hover:bg-neutral-700', dragging && 'bg-amber-500 dark:bg-amber-400')} />
                        </div>

                        <div
                            style={headerHeight ? { height: headerHeight } : undefined}
                            className="flex min-h-12 shrink-0 items-center gap-1 border-b border-neutral-200 px-3 dark:border-neutral-800"
                        >
                            {layer ? (
                                <>
                                    {layer.onBack && <IconButton label="Back" onClick={layer.onBack}><ArrowLeft className="h-4 w-4" /></IconButton>}
                                    <p className={cn('min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100', !layer.onBack && 'pl-1')}>{layer.title}</p>
                                    {layer.onClose && <IconButton label="Close" onClick={layer.onClose}><X className="h-4 w-4" /></IconButton>}
                                </>
                            ) : (
                                <>
                                    <Tabs value={tab} onValueChange={(v) => onTab(v === 'history' ? 'history' : 'needs')} className="min-w-0 flex-1">
                                        <TabsList fit size="sm">
                                            <TabsTrigger value="needs">Needs you</TabsTrigger>
                                            <TabsTrigger value="history">History</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                    <IconButton label="Close side column" onClick={onClose}><X className="h-4 w-4" /></IconButton>
                                </>
                            )}
                        </div>

                        {!layer && waiting ? <div className="shrink-0 px-3 pt-3">{waiting}</div> : null}

                        {/* Each view keeps its own scroll; the tabs stay mounted so History keeps its search. */}
                        <div className="relative flex min-h-0 flex-1 flex-col">
                            {layer && <div key={layer.key} className="flex min-h-0 flex-1 flex-col">{layer.body}</div>}
                            <div className={cn('flex min-h-0 flex-1 flex-col', (layer || tab !== 'needs') && 'hidden')}>{needs}</div>
                            <div className={cn('flex min-h-0 flex-1 flex-col', (layer || tab !== 'history') && 'hidden')}>{history}</div>
                        </div>
                    </aside>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
    return (
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClick} aria-label={label} title={label} className="h-8 w-8 shrink-0 cursor-pointer rounded-lg text-neutral-600 dark:text-neutral-400">
            {children}
        </Button>
    )
}
