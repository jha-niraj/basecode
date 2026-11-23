"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Pin / peek state for a desktop sidebar that hides completely and comes back on a left-edge
 * hover (the shell in components/shell/app-shell.tsx;
 * shared by every app).
 *
 * | State | Layout | Persisted |
 * |---|---|---|
 * | **pinned** | the rail is in the flow, content sits beside it | cookie |
 * | **unpinned** | the rail is out of the layout; a 12px hot edge reveals it as an OVERLAY | cookie |
 *
 * The cookie (not localStorage) is read by the server layout and passed in as `initialPinned`, so
 * the first frame is already right - an effect would paint it pinned and then slide it away.
 *
 * `tucked` is a temporary override that hides a pinned rail without touching the saved choice
 * (a wide workspace that wants the room). Any explicit pin / unpin calls
 * `onExplicitPin`, so the caller can drop its tuck: the user's own choice wins.
 */

const ONE_YEAR = 60 * 60 * 24 * 365
/** Intent delay before a left-edge hover opens the rail, so a pointer passing by does not flash it. */
const PEEK_OPEN_MS = 70
/** Grace before the peek closes: leaving the rail crosses the gap diagonally. */
const PEEK_CLOSE_MS = 180
/** A press inside the rail postpones (never cancels) a close - the theme wipe snapshots the page. */
const PEEK_LOCK_MS = 900

export interface PinPeek {
    /** The user's saved choice (cookie). */
    pinPref: boolean
    /** The rail is in the layout right now (saved choice, minus any tuck). */
    isPinned: boolean
    setPinned: (pinned: boolean) => void
    /** Raw peek flag - callers should AND it with `!isPinned && !isMobile`. */
    peeking: boolean
    peek: () => void
    peekSoon: () => void
    unpeek: () => void
    closePeek: () => void
    holdPeek: () => void
    lockPeek: (ms?: number) => void
}

export function usePinPeek({ initialPinned, cookieName, tucked = false, onExplicitPin }: {
    initialPinned: boolean
    /** The cookie storing "1" when unpinned. Give each app its own: localhost cookies ignore the port. */
    cookieName: string
    tucked?: boolean
    onExplicitPin?: () => void
}): PinPeek {
    const [pinPref, setPinPref] = useState(initialPinned)
    const [peeking, setPeeking] = useState(false)
    const isPinned = pinPref && !tucked

    const onExplicitRef = useRef(onExplicitPin)
    useEffect(() => { onExplicitRef.current = onExplicitPin }, [onExplicitPin])

    const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lockUntil = useRef(0)
    const clearTimers = useCallback(() => {
        if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null }
        if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    }, [])
    useEffect(() => clearTimers, [clearTimers])

    const setPinned = useCallback((pinned: boolean) => {
        clearTimers()
        setPinPref(pinned)
        onExplicitRef.current?.()
        // Unpinning from inside the rail must actually close it, not leave it under the pointer.
        setPeeking(false)
        try {
            document.cookie = `${cookieName}=${pinned ? "0" : "1"}; path=/; max-age=${ONE_YEAR}; samesite=lax`
        } catch { /* cookies blocked - the choice still holds for this session */ }
    }, [clearTimers, cookieName])

    const peek = useCallback(() => { clearTimers(); setPeeking(true) }, [clearTimers])
    const peekSoon = useCallback(() => {
        if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
        if (openTimer.current) return
        openTimer.current = setTimeout(() => { openTimer.current = null; setPeeking(true) }, PEEK_OPEN_MS)
    }, [])
    const holdPeek = useCallback(() => { clearTimers() }, [clearTimers])
    const lockPeek = useCallback((ms: number = PEEK_LOCK_MS) => {
        lockUntil.current = Math.max(lockUntil.current, Date.now() + ms)
        if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    }, [])
    const unpeek = useCallback(() => {
        clearTimers()
        const wait = Math.max(PEEK_CLOSE_MS, lockUntil.current - Date.now())
        closeTimer.current = setTimeout(() => { closeTimer.current = null; setPeeking(false) }, wait)
    }, [clearTimers])
    const closePeek = useCallback(() => {
        clearTimers()
        lockUntil.current = 0
        setPeeking(false)
    }, [clearTimers])

    // Cmd/Ctrl + \ toggles the pin (Notion / Linear). Not Cmd+B - that is bold in the editor.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key === "\\") {
                e.preventDefault()
                setPinned(!isPinned)
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [isPinned, setPinned])

    return { pinPref, isPinned, setPinned, peeking, peek, peekSoon, unpeek, closePeek, holdPeek, lockPeek }
}
