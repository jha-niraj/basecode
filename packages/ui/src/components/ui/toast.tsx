'use client'

import type { ReactNode } from 'react'
import { toast as sonner } from 'sonner'

/**
 * Gurukul's toast API, as an ADAPTER over this repo's own toast system (sonner, mounted through
 * `./sonner` `<Toaster />` in each app layout). Kept for basecode apps: basecode keeps sonner, and the
 * Gurukul components copied into packages/ui (toast-error and friends) call `toast.*` from here, so
 * their toasts land in the toaster the apps already mount.
 *
 * Same call shapes as Gurukul's `toast.tsx`: success / error / info / warning / message / loading,
 * progress, promise, undo, rich, dismiss. Where sonner has no equivalent the call degrades:
 * `progress` is a loading line with the percent as its description, `rich` drops the avatar.
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
    /** Milliseconds. Defaults by kind (see DURATION). `Infinity` = stays until closed. */
    duration?: number
    /** A stable key. A second toast with the same `id` replaces the first in place. */
    id?: string
    action?: ToastButton
    cancel?: { label: string; onClick?: () => void }
    icon?: ReactNode
}

export interface ProgressToastOptions extends Omit<ToastOptions, 'duration'> {
    /** 0-100. Clamped. */
    value: number
}

export interface UndoToastOptions {
    description?: string
    id?: string
    onUndo: () => void
    /** Milliseconds. Default 8000. */
    duration?: number
    /** Button text. Default "Undo". */
    label?: string
}

export interface RichToastOptions {
    description?: string
    id?: string
    duration?: number
    /** Accepted for API parity; sonner has no avatar slot, so it is not drawn. */
    avatar?: { name: string; src?: string | null }
    accept?: { label?: string; onClick: () => void }
    decline?: { label?: string; onClick?: () => void }
}

export interface PromiseToastMessages<T> {
    loading: string
    success: string | ((data: T) => string)
    /** Shown when the promise rejects, OR resolves to a failed `ActionResult` (`{ success: false }`). */
    error: string | ((err: unknown) => string)
    description?: string
    id?: string
}

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

type SonnerOptions = NonNullable<Parameters<typeof sonner>[1]>

function toSonner(kind: ToastKind, opts: ToastOptions = {}): SonnerOptions {
    const out: SonnerOptions = {
        duration: opts.duration ?? DURATION[kind],
    }
    if (opts.id !== undefined) out.id = opts.id
    if (opts.description !== undefined) out.description = opts.description
    if (opts.icon !== undefined) out.icon = opts.icon
    if (opts.action) {
        const run = opts.action.onClick
        out.action = { label: opts.action.label, onClick: () => run() }
    }
    if (opts.cancel) {
        const run = opts.cancel.onClick
        out.cancel = { label: opts.cancel.label, onClick: () => run?.() }
    }
    return out
}

function push(kind: ToastKind, message: string | undefined, opts?: ToastOptions): string {
    const text = message ?? ''
    const o = toSonner(kind, opts)
    switch (kind) {
        case 'success':
            return String(sonner.success(text, o))
        case 'error':
            return String(sonner.error(text, o))
        case 'info':
            return String(sonner.info(text, o))
        case 'warning':
            return String(sonner.warning(text, o))
        case 'loading':
        case 'progress':
            return String(sonner.loading(text, o))
        default:
            return String(sonner(text, o))
    }
}

function isFailedResult(v: unknown): v is { success: false; error?: unknown } {
    return typeof v === 'object' && v !== null && 'success' in v && (v as { success: unknown }).success === false
}

function promiseToast<T>(p: Promise<T> | (() => Promise<T>), m: PromiseToastMessages<T>): Promise<T> {
    const run = typeof p === 'function' ? p() : p
    const id = push('loading', m.loading, { id: m.id, description: m.description })
    const fail = (err: unknown) => {
        const reason =
            isFailedResult(err) && typeof err.error === 'string'
                ? err.error
                : err instanceof Error
                  ? err.message
                  : undefined
        if (typeof m.error === 'function') push('error', m.error(err), { id })
        else push('error', m.error, { id, description: reason })
    }
    run.then(
        (data) => {
            if (isFailedResult(data)) return fail(data)
            push('success', typeof m.success === 'function' ? m.success(data) : m.success, { id })
        },
        fail,
    )
    // The ORIGINAL promise, so `await toast.promise(save(), ...)` still yields the result.
    return run
}

function dismiss(key?: string) {
    sonner.dismiss(key)
}

/** The public API - shaped exactly like Gurukul's `toast`. */
export const toast = {
    success: (message: string | undefined, opts?: ToastOptions) => push('success', message, opts),
    error: (message: string | undefined, opts?: ToastOptions) => push('error', message, opts),
    info: (message: string | undefined, opts?: ToastOptions) => push('info', message, opts),
    warning: (message: string | undefined, opts?: ToastOptions) => push('warning', message, opts),
    message: (message: string | undefined, opts?: ToastOptions) => push('message', message, opts),
    /** A spinner line with no timer. Returns the id - pass it to `success`/`error` to finish it. */
    loading: (message: string | undefined, opts?: ToastOptions) => push('loading', message, opts),
    /** sonner has no bar: a loading line, the percent as its description unless one is given. */
    progress: (message: string | undefined, opts: ProgressToastOptions) => {
        const value = Math.max(0, Math.min(100, opts.value))
        return push('progress', message, {
            id: opts.id,
            description: opts.description ?? `${Math.round(value)}%`,
            action: opts.action,
            cancel: opts.cancel,
            icon: opts.icon,
        })
    },
    promise: promiseToast,
    undo: (message: string | undefined, opts: UndoToastOptions) =>
        push('undo', message, {
            id: opts.id,
            description: opts.description,
            duration: opts.duration ?? DURATION.undo,
            action: { label: opts.label ?? 'Undo', onClick: opts.onUndo },
        }),
    rich: (title: string | undefined, opts: RichToastOptions) =>
        push('rich', title, {
            id: opts.id,
            description: opts.description,
            duration: opts.duration,
            action: opts.accept ? { label: opts.accept.label ?? 'Accept', onClick: opts.accept.onClick } : undefined,
            cancel: opts.decline ? { label: opts.decline.label ?? 'Decline', onClick: opts.decline.onClick } : undefined,
        }),
    dismiss,
}

export type ToasterPosition = 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center'

/** The toaster is this repo's sonner one - mount it once per app, as the layouts already do. */
export { Toaster } from './sonner'

export default toast
