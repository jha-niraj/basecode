/**
 * Peek addresses: `/peek/<kind>/<id>` - an ADDRESS for a quick look beside the chat, not a route. Pure module (server
 * and client). A project adds its kinds here (an invoice, a document ...), each with a body in components/peeks.
 */
export const PEEK_KINDS = ['user'] as const
export type PeekKind = (typeof PEEK_KINDS)[number]

export interface PeekAddress {
    kind: PeekKind
    id: string
    href: string
}

export function isPeekHref(href: string): boolean {
    return href.startsWith('/peek/')
}

export function parsePeekHref(href: string): PeekAddress | null {
    const path = href.split('?')[0] ?? ''
    const [, peek, kind, id] = path.split('/')
    if (peek !== 'peek' || !kind || !id) return null
    if (!(PEEK_KINDS as readonly string[]).includes(kind)) return null
    return { kind: kind as PeekKind, id: decodeURIComponent(id), href }
}

export function userPeekHref(userId: string): string {
    return `/peek/user/${encodeURIComponent(userId)}`
}

/** The `?peek=` value on the AI page URL. */
export const PEEK_PARAM = 'peek'
