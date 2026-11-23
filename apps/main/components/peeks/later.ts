/**
 * Peek reads for React 19 `use()`.
 *
 * - The read starts on the next microtask, so a server action is never CALLED during render (that updates the Router
 *   mid-render: "Cannot update Router while rendering").
 * - The promise is cached OUTSIDE the component, by key: a component that suspends on its first render never commits,
 *   so a `useMemo` promise would be thrown away and re-created on every retry (an endless suspend).
 * - An entry lives 30 seconds, so re-renders reuse it and a peek opened again later reads fresh data. (Not deleted on
 *   unmount: dev Strict Mode unmounts once after the first commit, and a re-render would then suspend again.)
 */
const TTL_MS = 30_000
const reads = new Map<string, { at: number; promise: Promise<unknown> }>()

export function cachedRead<T>(key: string, read: () => Promise<T>): Promise<T> {
    const now = Date.now()
    const hit = reads.get(key)
    if (hit && now - hit.at < TTL_MS) return hit.promise as Promise<T>
    const promise = Promise.resolve().then(read)
    reads.set(key, { at: now, promise })
    if (reads.size > 30) {
        const oldest = reads.keys().next().value
        if (oldest !== undefined) reads.delete(oldest)
    }
    return promise
}

/** Drop a cached read (after a write that changed it). */
export function forgetRead(key: string): void {
    reads.delete(key)
}
