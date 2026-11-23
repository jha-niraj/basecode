"use client"

/**
 * RelativeTime - "9h 15m ago" / "in 2h", without a hydration mismatch.
 *
 * Text worked out from `new Date()` during render differs between the server and the browser by however long the page
 * took to hydrate, and `toLocaleString()` differs by the server's timezone and locale - React then reports a hydration
 * error (admin /cron showed it on every load, 2026-10-26). So the server and the first client paint render the SAME
 * text: the absolute time, formatted in a fixed timezone and locale. After mount it switches to the relative text,
 * keeps it fresh every minute, and the tooltip (`data-tip`, the shared TipLayer) carries the full local date.
 */
import { useEffect, useState } from "react"

import { cn } from "../../lib/utils"

const MINUTE_MS = 60_000

/** The default relative text: "less than a minute ago", "15m ago", "9h 15m ago", "3d 4h ago", "in 2h". */
export function formatRelativeTime(target: Date, now: Date): string {
    const deltaMs = target.getTime() - now.getTime()
    const past = deltaMs < 0
    const mins = Math.round(Math.abs(deltaMs) / MINUTE_MS)
    let text: string
    if (mins < 1) text = "less than a minute"
    else if (mins < 60) text = `${mins}m`
    else if (mins < 24 * 60) {
        const h = Math.floor(mins / 60)
        const m = mins % 60
        text = m ? `${h}h ${m}m` : `${h}h`
    } else {
        const d = Math.floor(mins / (24 * 60))
        const h = Math.floor((mins % (24 * 60)) / 60)
        text = h ? `${d}d ${h}h` : `${d}d`
    }
    return past ? `${text} ago` : `in ${text}`
}

export interface RelativeTimeProps {
    /** The moment, as an ISO string or a Date. */
    value: string | Date
    /** Custom relative text (e.g. a package's own formatter); defaults to `formatRelativeTime`. */
    format?: (target: Date, now: Date) => string
    /** The timezone of the server/first-paint absolute text. Same on both sides by construction. */
    timeZone?: string
    className?: string
}

export function RelativeTime({ value, format = formatRelativeTime, timeZone = "UTC", className }: RelativeTimeProps) {
    const date = typeof value === "string" ? new Date(value) : value
    const [now, setNow] = useState<Date | null>(null)

    useEffect(() => {
        setNow(new Date())
        const t = window.setInterval(() => setNow(new Date()), MINUTE_MS)
        return () => window.clearInterval(t)
    }, [])

    if (Number.isNaN(date.getTime())) return <span className={className}>-</span>

    // Server + first paint: a fixed locale and timezone, so both sides print the same characters.
    const absolute = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(date)

    return (
        <time
            dateTime={date.toISOString()}
            className={cn("tabular-nums", className)}
            data-tip={now ? date.toLocaleString() : undefined}
        >
            {now ? format(date, now) : absolute}
        </time>
    )
}
