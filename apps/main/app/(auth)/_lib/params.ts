/** Page searchParams as Next 16 passes them (a promise of string | string[] values). */
export type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** The first value of a search param, trimmed, or null. */
export function param(sp: Record<string, string | string[] | undefined>, key: string): string | null {
    const v = sp[key]
    const s = Array.isArray(v) ? v[0] : v
    const t = s?.trim()
    return t ? t : null
}
