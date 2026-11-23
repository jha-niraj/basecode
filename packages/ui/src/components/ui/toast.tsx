'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
    CircleCheckIcon,
    InfoIcon,
    OctagonXIcon,
    TriangleAlertIcon,
    Undo2Icon,
    XIcon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '../../lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Spinner } from './spinner'
import { playSound } from './sounds'

/**
 * The toast system, replacing sonner.
 *
 * ## A DROP-IN, on purpose
 *
 * 335 files raise toasts, and the surface they use was measured rather than guessed: `error` 1,230,
 * `success` 716, `info` 23, `warning` 13, `message` 3, with ZERO bare `toast()` calls. Options in
 * use are `description`, `duration`, `id` and `action`. Those five methods and four options are
 * unchanged - the kinds below were ADDED around them (2026-10-23, after ReUI's sonner examples), so
 * not one existing call site moves.
 *
 * ## The kinds
 *
 * | Call | What it is |
 * |---|---|
 * | `toast.success/error/info/warning/message(msg, opts)` | the original five |
 * | `toast.loading(msg, opts)` | a spinner line that stays until replaced - returns its id |
 * | `toast.success(msg, { id })` | replaces a loading/progress toast IN PLACE (same for error) |
 * | `toast.promise(p, { loading, success, error })` | loading, then success or error when `p` settles |
 * | `toast.progress(msg, { id, value })` | a bar updated in place; finish with `toast.success(.., { id })` |
 * | `toast.undo(msg, { onUndo })` | an Undo button with a visible countdown; on timeout it just goes |
 * | `toast.rich(title, { avatar, accept, decline })` | a person's avatar, title, two buttons |
 * | `{ duration: Infinity }` | persistent; always carries a close button |
 * | `{ action, cancel }` | a primary button and a quiet one that just closes |
 * | `{ icon }` | replaces the kind's icon |
 *
 * ## The store is a module-level list, not a context
 *
 * `toast.error(...)` is called from server-action handlers, stores and plain functions - places with
 * no React tree above them. A module-level subscription list lets the call stay a function call.
 *
 * ## Colours are inverted against the page, and that is inherited deliberately
 *
 * Light mode gets a near-black toast, dark mode a warm beige one: a toast is a temporary overlay,
 * and being the opposite of the page is what stops it reading as part of the page.
 */

export type ToastKind =
    | 'success'
    | 'error'
    | 'info'
    | 'warning'
    | 'message'
    | 'loading'
    | 'progress'
    | 'undo'
    | 'rich'

export interface ToastButton {
    label: string
    onClick: () => void
}

export interface ToastOptions {
    description?: string
    /** Milliseconds. Defaults by kind - errors are given longer, see DURATION. `Infinity` = stays until closed. */
    duration?: number
    /**
     * A stable key. A second toast with the same `id` REPLACES the first in place instead of
     * stacking - which is what turns "save failed" x8 from a bulk action into one message, and what
     * turns a `loading` toast into its `success`.
     */
    id?: string
    /** The primary button. Used for Retry, Undo, and for jumping to the thing just created. */
    action?: ToastButton
    /** A quiet second button that closes the toast (its `onClick` runs first, when given). */
    cancel?: { label: string; onClick?: () => void }
    /** Replaces the kind's icon (a lucide icon at `size-4`, usually). */
    icon?: ReactNode
}

export interface ProgressToastOptions extends Omit<ToastOptions, 'duration'> {
    /** 0-100. Clamped. */
    value: number
}

export interface UndoToastOptions {
    description?: string
    id?: string
    /** Runs the REAL inverse action. The toast closes the moment it is pressed. */
    onUndo: () => void
    /** Milliseconds. Default 8000. The countdown is shown; when it runs out the toast simply goes. */
    duration?: number
    /** Button text. Default "Undo". */
    label?: string
}

export interface RichToastOptions {
    description?: string
    id?: string
    duration?: number
    avatar?: { name: string; src?: string | null }
    accept?: { label?: string; onClick: () => void }
    decline?: { label?: string; onClick?: () => void }
}

export interface PromiseToastMessages<T> {
    loading: string
    success: string | ((data: T) => string)
    /**
     * Shown when the promise rejects, OR when it resolves to a failed `ActionResult`
     * (`{ success: false }`) - most server actions report failure by resolving, not throwing.
     * A plain string gets the action's own `error` text as its description.
     */
    error: string | ((err: unknown) => string)
    description?: string
    id?: string
}

interface ToastItem {
    key: string
    kind: ToastKind
    message: string
    description?: string
    duration: number
    action?: ToastButton
    cancel?: { label: string; onClick?: () => void }
    icon?: ReactNode
    value?: number
    avatar?: { name: string; src?: string | null }
}

/**
 * Errors stay longer than anything else.
 *
 * A success confirms something the reader just did - they already know, and four seconds is
 * generous. An error is news, usually a sentence that has to be READ. Loading and progress have
 * no timer: they end when the work does, by being replaced.
 */
const DURATION: Record<ToastKind, number> = {
    success: 4000,
    error: 7000,
    warning: 6000,
    info: 5000,
    message: 5000,
    loading: Infinity,
    progress: Infinity,
    undo: 8000,
    rich: 10000,
}

/**
 * The most toasts on screen at once.
 *
 * Past four the oldest is gone before it is read, and a per-row bulk failure can raise dozens.
 * The oldest TIMED toast goes first, so a loading line or a persistent notice is not pushed off by
 * a burst of successes.
 */
const MAX_VISIBLE = 4

/**
 * What is shown when the message is `undefined`.
 *
 * Ten call sites write `toast.error(result.error)` against an `error` that is optional on the
 * failure type. The signature is `string | undefined` so those sites keep compiling, and this map
 * is what makes that safe.
 */
const FALLBACK: Record<ToastKind, string> = {
    success: 'Done.',
    error: 'Something went wrong. Please try again.',
    warning: 'Something needs your attention.',
    info: 'Something happened.',
    message: 'Something happened.',
    loading: 'Working...',
    progress: 'Working...',
    undo: 'Done.',
    rich: 'New notification.',
}

let seq = 0
let items: ToastItem[] = []
const listeners = new Set<(v: ToastItem[]) => void>()

// ---------------------------------------------------------------------------------------------
// Timers - pausable, so hovering the stack (or leaving the tab) holds every toast where it is.
// ---------------------------------------------------------------------------------------------

interface Timer {
    handle?: ReturnType<typeof setTimeout>
    deadline: number
    remaining: number
    total: number
}
const timers = new Map<string, Timer>()
let hovered = false
let hidden = false
const isPaused = () => hovered || hidden

function emit() {
    // A fresh array each time: the listeners are React setState, and a mutated array is the same
    // reference, so nothing would re-render.
    const snapshot = [...items]
    for (const l of listeners) l(snapshot)
}

function clearTimer(key: string) {
    const t = timers.get(key)
    if (t?.handle) clearTimeout(t.handle)
    timers.delete(key)
}

function schedule(key: string, ms: number) {
    // `setTimeout(fn, Infinity)` fires IMMEDIATELY (the delay overflows), so a persistent toast
    // must never reach it.
    if (!Number.isFinite(ms) || ms <= 0) return
    const t: Timer = { deadline: Date.now() + ms, remaining: ms, total: ms }
    if (!isPaused()) t.handle = setTimeout(() => dismiss(key), ms)
    timers.set(key, t)
}

function syncPause() {
    const now = Date.now()
    for (const [key, t] of timers) {
        if (isPaused() && t.handle) {
            clearTimeout(t.handle)
            t.handle = undefined
            t.remaining = Math.max(0, t.deadline - now)
        } else if (!isPaused() && !t.handle) {
            t.deadline = now + t.remaining
            t.handle = setTimeout(() => dismiss(key), t.remaining)
        }
    }
}

/** Milliseconds left on a timed toast, and its total - for the undo countdown. */
function timeLeft(key: string): { left: number; total: number } | null {
    const t = timers.get(key)
    if (!t) return null
    const left = isPaused() || !t.handle ? t.remaining : Math.max(0, t.deadline - Date.now())
    return { left, total: t.total }
}

/** Close one toast, or every toast when called with no id (sonner's behaviour). */
function dismiss(key?: string) {
    if (key === undefined) {
        for (const k of [...timers.keys()]) clearTimer(k)
        items = []
    } else {
        clearTimer(key)
        items = items.filter((t) => t.key !== key)
    }
    emit()
}

function trim(list: ToastItem[]): ToastItem[] {
    const next = [...list]
    while (next.length > MAX_VISIBLE) {
        const at = next.findIndex((t) => Number.isFinite(t.duration))
        const gone = next.splice(at >= 0 ? at : 0, 1)[0]
        if (gone) clearTimer(gone.key)
    }
    return next
}

const SOUNDED: ReadonlySet<ToastKind> = new Set(['success', 'error'])
const SILENT_PLACEHOLDER: ReadonlySet<ToastKind> = new Set(['loading', 'progress'])

function put(
    kind: ToastKind,
    message: string | undefined,
    opts: Omit<ToastItem, 'key' | 'kind' | 'message' | 'duration'> & { id?: string; duration?: number },
): string {
    const key = opts.id ?? `t${++seq}`
    const item: ToastItem = {
        key,
        kind,
        message: message?.trim() || FALLBACK[kind],
        description: opts.description,
        duration: opts.duration ?? DURATION[kind],
        action: opts.action,
        cancel: opts.cancel,
        icon: opts.icon,
        value: opts.value,
        avatar: opts.avatar,
    }

    const at = items.findIndex((t) => t.key === key)
    const prev = at >= 0 ? items[at] : undefined
    if (prev) {
        // In PLACE, not appended. A deduped burst that jumped to the top of the stack each time
        // would shove the other toasts around once per failure.
        const next = [...items]
        next[at] = item
        items = next
        clearTimer(key)
    } else {
        items = trim([...items, item])
    }
    emit()

    // Success and error only (sounds.tsx). A plain replacement is a repeat of something the reader
    // has already heard - eight chimes for eight identical failures is noise - EXCEPT when it is a
    // silent loading/progress line turning into its result: that is the first time the outcome is
    // told, so it plays once.
    if (SOUNDED.has(kind) && (!prev || SILENT_PLACEHOLDER.has(prev.kind))) playSound(kind as 'success' | 'error')

    schedule(key, item.duration)
    return key
}

function push(kind: ToastKind, message: string | undefined, opts?: ToastOptions): string {
    return put(kind, message, { ...opts })
}

function isFailedResult(v: unknown): v is { success: false; error?: unknown } {
    return typeof v === 'object' && v !== null && 'success' in v && (v as { success: unknown }).success === false
}

function promiseToast<T>(p: Promise<T> | (() => Promise<T>), m: PromiseToastMessages<T>): Promise<T> {
    const run = typeof p === 'function' ? p() : p
    const id = put('loading', m.loading, { id: m.id, description: m.description })
    const fail = (err: unknown) => {
        const reason =
            isFailedResult(err) && typeof err.error === 'string'
                ? err.error
                : err instanceof Error
                  ? err.message
                  : undefined
        if (typeof m.error === 'function') put('error', m.error(err), { id })
        else put('error', m.error, { id, description: reason })
    }
    run.then(
        (data) => {
            if (isFailedResult(data)) return fail(data)
            put('success', typeof m.success === 'function' ? m.success(data) : m.success, { id })
        },
        fail,
    )
    // The ORIGINAL promise, so `await toast.promise(save(), ...)` still yields the result. Our
    // handler above already marks a rejection as handled.
    return run
}

/**
 * The public API. The first five are shaped exactly like the sonner calls they replaced.
 */
export const toast = {
    success: (message: string | undefined, opts?: ToastOptions) => push('success', message, opts),
    error: (message: string | undefined, opts?: ToastOptions) => push('error', message, opts),
    info: (message: string | undefined, opts?: ToastOptions) => push('info', message, opts),
    warning: (message: string | undefined, opts?: ToastOptions) => push('warning', message, opts),
    message: (message: string | undefined, opts?: ToastOptions) => push('message', message, opts),
    /** A spinner line with no timer. Returns the id - pass it to `success`/`error` to finish it. */
    loading: (message: string | undefined, opts?: ToastOptions) => push('loading', message, opts),
    /** A bar, updated in place by calling again with the same `id`. Silent. */
    progress: (message: string | undefined, opts: ProgressToastOptions) =>
        put('progress', message, { ...opts, value: Math.max(0, Math.min(100, opts.value)) }),
    promise: promiseToast,
    /** A soft action just happened; offer to reverse it for `duration` ms, with a countdown. */
    undo: (message: string | undefined, opts: UndoToastOptions) =>
        put('undo', message, {
            id: opts.id,
            description: opts.description,
            duration: opts.duration ?? DURATION.undo,
            action: { label: opts.label ?? 'Undo', onClick: opts.onUndo },
        }),
    /** A person's avatar, a title, and Accept / Decline. */
    rich: (title: string | undefined, opts: RichToastOptions) =>
        put('rich', title, {
            id: opts.id,
            description: opts.description,
            duration: opts.duration,
            avatar: opts.avatar,
            action: opts.accept ? { label: opts.accept.label ?? 'Accept', onClick: opts.accept.onClick } : undefined,
            cancel: opts.decline ? { label: opts.decline.label ?? 'Decline', onClick: opts.decline.onClick } : undefined,
        }),
    dismiss,
}

const ICON: Partial<Record<ToastKind, typeof InfoIcon>> = {
    success: CircleCheckIcon,
    error: OctagonXIcon,
    warning: TriangleAlertIcon,
    info: InfoIcon,
    message: InfoIcon,
    undo: Undo2Icon,
}

export type ToasterPosition = 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'

const PLACEMENT: Record<ToasterPosition, string> = {
    'top-right': 'top-4 right-4 items-end',
    'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
    'bottom-right': 'bottom-4 right-4 items-end',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
}

export interface ToasterProps {
    /** Every app mounts `top-right` (the owner, 2026-10-23, final). Kept as a prop for completeness. */
    position?: ToasterPosition
    closeButton?: boolean
    /** Accepted and ignored - a sonner-ism; this toaster always colours by kind. */
    richColors?: boolean
}

interface Palette {
    bg: string
    fg: string
    border: string
    accent: Record<ToastKind, string>
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?'
}

/** The undo countdown: seconds left plus a bar that empties. Holds while the stack is hovered. */
function Countdown({ id, fg }: { id: string; fg: string }) {
    const [state, setState] = useState(() => timeLeft(id))
    useEffect(() => {
        const h = setInterval(() => setState(timeLeft(id)), 200)
        return () => clearInterval(h)
    }, [id])
    if (!state) return null
    const pct = state.total > 0 ? (state.left / state.total) * 100 : 0
    return (
        <>
            <span className="shrink-0 text-[12px] tabular-nums opacity-70" aria-hidden>
                {Math.ceil(state.left / 1000)}s
            </span>
            <span
                className="absolute inset-x-0 bottom-0 h-[2px] origin-left opacity-40"
                style={{ background: fg, transform: `scaleX(${pct / 100})`, transition: 'transform 200ms linear' }}
                aria-hidden
            />
        </>
    )
}

function ToastCard({ t, closeButton, p }: { t: ToastItem; closeButton: boolean; p: Palette }) {
    const Icon = ICON[t.kind]
    const persistent = !Number.isFinite(t.duration)
    // A persistent notice MUST be closable; a loading line is closed by its own result.
    const showClose = (closeButton || (persistent && t.kind !== 'loading' && t.kind !== 'progress'))
    const accent = p.accent[t.kind]

    const lead =
        t.icon ??
        (t.kind === 'loading' || t.kind === 'progress' ? (
            <Spinner className="mt-[1px] size-4 opacity-70" />
        ) : t.kind === 'rich' && t.avatar ? (
            <Avatar className="size-8">
                {t.avatar.src && <AvatarImage src={t.avatar.src} alt="" />}
                <AvatarFallback className="text-[11px] font-semibold" style={{ background: p.fg, color: p.bg }}>
                    {initials(t.avatar.name)}
                </AvatarFallback>
            </Avatar>
        ) : Icon ? (
            <Icon className="mt-[1px] size-4 shrink-0" style={{ color: accent }} />
        ) : null)

    return (
        <div
            // `assertive` for an error so a screen reader interrupts with it, polite for the rest.
            role={t.kind === 'error' ? 'alert' : 'status'}
            aria-live={t.kind === 'error' ? 'assertive' : 'polite'}
            aria-busy={t.kind === 'loading' || t.kind === 'progress' ? true : undefined}
            className="gk-toast-in pointer-events-auto relative flex w-full items-start gap-2.5 overflow-hidden rounded-[var(--radius)] px-3.5 py-3 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.45)]"
            style={{ background: p.bg, color: p.fg, border: `1px solid ${p.border}` }}
        >
            {lead && <span className="flex shrink-0 items-start">{lead}</span>}
            <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-[13.5px] leading-snug font-medium" style={{ color: accent }}>
                        {t.message}
                    </p>
                    {t.kind === 'progress' && t.value !== undefined && (
                        <span className="shrink-0 text-[12px] tabular-nums opacity-70">{Math.round(t.value)}%</span>
                    )}
                    {t.kind === 'undo' && <Countdown id={t.key} fg={p.fg} />}
                </div>
                {t.description && (
                    // `currentColor` at 80%, never a grey from a scale - a scale grey is inverted
                    // against this background and goes near-invisible.
                    <p className="mt-0.5 text-[12.5px] leading-snug opacity-80">{t.description}</p>
                )}
                {t.kind === 'progress' && t.value !== undefined && (
                    <div
                        className="mt-2 h-1 w-full overflow-hidden rounded-full"
                        style={{ background: `color-mix(in srgb, ${p.fg} 18%, transparent)` }}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(t.value)}
                    >
                        <div
                            className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300"
                            style={{ width: `${t.value}%`, background: p.fg }}
                        />
                    </div>
                )}
                {(t.action || t.cancel) && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {t.action && (
                            <button
                                type="button"
                                onClick={() => {
                                    // Closed FIRST: the action is the whole point of the toast, and
                                    // a toast left up invites a second press (a double undo).
                                    dismiss(t.key)
                                    t.action?.onClick()
                                }}
                                className="cursor-pointer rounded-md px-2 py-1 text-[12px] font-medium transition-opacity hover:opacity-80"
                                style={{ background: p.fg, color: p.bg }}
                            >
                                {t.action.label}
                            </button>
                        )}
                        {t.cancel && (
                            <button
                                type="button"
                                onClick={() => {
                                    dismiss(t.key)
                                    t.cancel?.onClick?.()
                                }}
                                className="cursor-pointer rounded-md px-2 py-1 text-[12px] font-medium opacity-75 transition-opacity hover:opacity-100"
                                style={{ border: `1px solid color-mix(in srgb, ${p.fg} 25%, transparent)` }}
                            >
                                {t.cancel.label}
                            </button>
                        )}
                    </div>
                )}
            </div>
            {showClose && (
                <button
                    type="button"
                    onClick={() => dismiss(t.key)}
                    aria-label="Dismiss"
                    className="-mr-1 shrink-0 cursor-pointer rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
                >
                    <XIcon className="size-3.5" />
                </button>
            )}
        </div>
    )
}

/**
 * The host. One per app, in the root layout.
 *
 * Rendered through a PORTAL to `document.body`: a toast mounted inside the layout tree inherits any
 * ancestor's `transform`, `filter` or `overflow`, and any one of those turns `position: fixed` into
 * "fixed relative to that ancestor". The Deck's window layer and the playful shell both apply
 * transforms.
 *
 * Newest on top (nearest the edge it is anchored to). Hovering the stack pauses every timer, and so
 * does leaving the tab - a toast should not expire unread behind another window.
 */
export function Toaster({ position = 'top-right', closeButton = false }: ToasterProps) {
    const [list, setList] = useState<ToastItem[]>([])
    const [mounted, setMounted] = useState(false)
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === 'dark'

    useEffect(() => {
        setMounted(true)
        listeners.add(setList)
        setList([...items])
        const onVis = () => {
            hidden = document.visibilityState === 'hidden'
            syncPause()
        }
        document.addEventListener('visibilitychange', onVis)
        return () => {
            listeners.delete(setList)
            document.removeEventListener('visibilitychange', onVis)
        }
    }, [])

    // No portal target during SSR, and `resolvedTheme` is undefined on the first client pass.
    if (!mounted) return null

    // Inverted against the page. Literals rather than tokens because the inversion is the point.
    const fg = isDark ? '#1c1917' : '#fafafa'
    const p: Palette = {
        bg: isDark ? '#EDE8D0' : '#0a0a0a',
        fg,
        border: isDark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)',
        accent: {
            // Green only on the transient success line (AGENTS.md colour carve-out).
            success: isDark ? '#047857' : '#34d399',
            error: isDark ? '#be123c' : '#fb7185',
            warning: isDark ? '#b45309' : '#fbbf24',
            info: fg,
            message: fg,
            loading: fg,
            progress: fg,
            undo: fg,
            rich: fg,
        },
    }

    const top = position.startsWith('top')
    const ordered = top ? [...list].reverse() : list

    return createPortal(
        <div
            // `z-[100]`, above the modal layer at z-50: a toast raised BY a dialog has to show over it.
            className={cn(
                'pointer-events-none fixed z-[100] flex w-[min(92vw,380px)] flex-col gap-2',
                PLACEMENT[position],
            )}
            role="region"
            data-toast-region=""
            aria-label="Notifications"
            onMouseEnter={() => {
                hovered = true
                syncPause()
            }}
            onMouseLeave={() => {
                hovered = false
                syncPause()
            }}
        >
            {ordered.map((t) => (
                <ToastCard key={t.key} t={t} closeButton={closeButton} p={p} />
            ))}

            {/* `prefers-reduced-motion` drops the entrance entirely. */}
            <style>{`
                @keyframes gk-toast-in {
                    from { opacity: 0; transform: translateY(${top ? '-8px' : '8px'}) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                .gk-toast-in { animation: gk-toast-in 180ms cubic-bezier(0.22,1,0.36,1) both; }
                @media (prefers-reduced-motion: reduce) {
                    .gk-toast-in { animation: none; }
                }
            `}</style>
        </div>,
        document.body,
    )
}

export default toast
