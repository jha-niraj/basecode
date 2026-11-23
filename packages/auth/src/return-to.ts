/**
 * `returnTo` / `callbackUrl` goes through here before any redirect - otherwise `?returnTo=https://evil.example` is an
 * open redirect. IMPORT-FREE: the middleware, server pages and client components all use it.
 *
 * Accepts only a same-origin PATH: starts with one `/`, no `//` or `/\` (protocol-relative), no scheme, no control
 * characters, no backslashes. Anything else gets the fallback.
 */
export function safeReturnTo(raw: string | null | undefined, fallback: string): string {
    if (!raw) return fallback
    let value = raw.trim()
    // A value that was encoded once more than needed (`%2Fai`) is decoded once.
    if (/^%2f/i.test(value)) {
        try {
            value = decodeURIComponent(value)
        } catch {
            return fallback
        }
    }
    if (!value.startsWith('/')) return fallback
    if (value.startsWith('//') || value.startsWith('/\\')) return fallback
    if (value.includes('\\')) return fallback
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
    // A scheme smuggled after the slash (`/javascript:...` is a path, but `/:` games are not worth allowing).
    if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return fallback
    try {
        // Resolve against a dummy origin: if the origin changes, it was not a plain path.
        const url = new URL(value, 'http://return-to.invalid')
        if (url.origin !== 'http://return-to.invalid') return fallback
        return `${url.pathname}${url.search}${url.hash}`
    } catch {
        return fallback
    }
}
