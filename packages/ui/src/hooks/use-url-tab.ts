"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

/**
 * A page's active tab, kept in `?tab=` so a reload or a shared link lands on the same tab.
 *
 *   // page.tsx (server):  <Client initialTab={(await searchParams).tab} />
 *   // client:
 *   const [tab, setTab] = useUrlTab(["overview", "runs"] as const, initialTab, "overview")
 *   <Page tabs={[...]} tab={tab} onTabChange={(v) => setTab(v as typeof tab)}>
 *
 * - Seeded from the server's `searchParams`, so the first paint already shows the right tab (no flash of the
 *   fallback before a client effect reads the URL).
 * - Written with `history.replaceState`, never `router.push` / `router.replace`: those re-run the route's server
 *   components for what is a client-only switch. Next folds replaceState into its router, so `useSearchParams`
 *   still updates, and the hook reads it back to follow a `<Link href="?tab=x">` or any other URL change.
 * - The fallback tab removes the param, so the plain URL is the default tab.
 * - An unknown value (a stale link) falls back instead of rendering an empty panel.
 *
 * `useSearchParams` makes a statically rendered route bail out to client rendering up to the nearest Suspense
 * boundary; every page using this is behind auth and dynamic already, so it costs nothing there.
 */
export function useUrlTab<T extends string>(
    values: readonly T[],
    initial: string | string[] | null | undefined,
    fallback: T,
    param = "tab",
): [T, (next: T) => void] {
    const pick = React.useCallback(
        (v: string | string[] | null | undefined): T => {
            const s = Array.isArray(v) ? v[0] : v
            return s != null && (values as readonly string[]).includes(s) ? (s as T) : fallback
        },
        // values is usually an inline array; its contents, not its identity, decide the result.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [values.join("|"), fallback],
    )

    const [tab, setTabState] = React.useState<T>(() => pick(initial))
    const searchParams = useSearchParams()
    const urlValue = searchParams?.get(param) ?? null
    // What this hook last wrote, so its own write echoing back through useSearchParams is not treated as a change.
    const lastUrl = React.useRef<string | null>(urlValue)

    React.useEffect(() => {
        if (urlValue === lastUrl.current) return
        lastUrl.current = urlValue
        setTabState(pick(urlValue))
    }, [urlValue, pick])

    const setTab = React.useCallback(
        (next: T) => {
            const value = pick(next)
            setTabState(value)
            const url = new URL(window.location.href)
            if (value === fallback) url.searchParams.delete(param)
            else url.searchParams.set(param, value)
            lastUrl.current = value === fallback ? null : value
            window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
        },
        [pick, fallback, param],
    )

    return [tab, setTab]
}
