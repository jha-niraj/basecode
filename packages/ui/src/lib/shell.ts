import type { ComponentType } from "react"

/**
 * The app shell's data model and pure helpers, shared by every app (apps/main, apps/admin).
 *
 * Plain module - no "use client" / "server-only" - so a server layout can import the cookie helpers and read the rail
 * state before the first paint, and the client shell can import the nav helpers.
 */

export interface ShellNavItem {
    name: string
    /** Absolute, with a leading slash: "/users". */
    href: string
    /** The path the link counts as active under, when it differs from `href`. Defaults to `href`. */
    match?: string
    icon: ComponentType<{ className?: string }>
    /** A small count after the label (unread, pending). 0 or undefined draws nothing. */
    badge?: number
    /** Show this item in the phone bottom bar (the first four that set it; with none set, the first four items). */
    tab?: boolean
}

export interface ShellNavSection {
    id: string
    /** A small heading over the group. Omit for the first, unlabeled group. */
    label?: string
    items: ShellNavItem[]
}

export interface ShellUser {
    name: string
    email: string
    image?: string | null
}

/** One extra row in the account menu (Profile and Sign out are always there). */
export interface ShellMenuLink {
    label: string
    href: string
    icon?: ComponentType<{ className?: string }>
}

export const isUnder = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`)

/** The nav item the current path belongs to: the longest match wins (a detail page lights its list). */
export function activeHref(pathname: string, sections: ShellNavSection[]): string | null {
    let best: string | null = null
    let bestLen = -1
    for (const s of sections) for (const it of s.items) {
        const m = it.match ?? it.href
        if (isUnder(pathname, m) && m.length > bestLen) { best = it.href; bestLen = m.length }
    }
    return best
}

/** The phone bottom bar: items marked `tab`, else the first four. */
export function tabItems(sections: ShellNavSection[], max = 4): ShellNavItem[] {
    const all = sections.flatMap((s) => s.items)
    const marked = all.filter((i) => i.tab)
    return (marked.length ? marked : all).slice(0, max)
}

/**
 * The rail cookie: "1" = the person UNPINNED the rail (hidden, peeks on a left-edge hover); anything else = pinned.
 * Each app passes its own name - cookies on localhost ignore the port, so two apps would share one otherwise.
 */
export function railPinnedFromCookie(value: string | undefined | null): boolean {
    return value !== "1"
}

/** The rail's width when pinned: 240px by default, the person can drag it between these. */
export const RAIL_WIDTH = { min: 200, default: 240, max: 360 } as const

/** The width cookie sits beside the pin cookie: `<cookieName>_w`. */
export const railWidthCookie = (cookieName: string) => `${cookieName}_w`

/** Read on the server (no first-frame jump): `railWidthFromCookie(cookies().get(railWidthCookie(name))?.value)`. */
export function railWidthFromCookie(value: string | undefined | null): number {
    const n = Number(value)
    return Number.isFinite(n) && n >= RAIL_WIDTH.min && n <= RAIL_WIDTH.max ? Math.round(n) : RAIL_WIDTH.default
}
