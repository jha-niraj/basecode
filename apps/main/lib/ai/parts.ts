import type { MessagePart } from '@repo/ai/protocol'

/** Narrow a stored `parts` jsonb value. Rows are written by our own route; anything malformed is dropped, never thrown. */
export function asParts(value: unknown): MessagePart[] {
    if (!Array.isArray(value)) return []
    return value.filter((p): p is MessagePart => {
        if (typeof p !== 'object' || p === null || !('type' in p)) return false
        const t = p.type
        return t === 'text' || t === 'thought' || t === 'tool' || t === 'card' || t === 'link' || t === 'notice'
    })
}
