/**
 * Sign-out answered BEFORE Next. IMPORT-FREE apart from ./cookies (no better-auth, no Next): worker.ts loads it
 * outside the Next bundle.
 *
 * better-auth's own `/api/auth/sign-out` clears the cookies only in its reply, and that reply waits for its database
 * work inside the Next bundle - on a cold isolate, seconds. So each app's `worker.ts` answers `POST /api/sign-out`
 * itself: expire every session cookie, reply 204 at once, and run better-auth's real sign-out in `waitUntil` with the
 * ORIGINAL cookies (that deletes the session row). Under `next dev` (no worker.ts) next.config.js rewrites the path to
 * `/api/auth/app-sign-out`, which does the same inside Next (`signOutTwin` in ./next).
 */
import { authCookiePrefix, isAuthCookieName, SECURE_PREFIX } from './cookies'

/** The path `useSignOut` posts to. */
export const SIGN_OUT_PATH = '/api/sign-out'

/** better-auth's own sign-out endpoint. */
export const AUTH_SIGN_OUT_PATH = '/api/auth/sign-out'

export interface SignOutOptions {
    /** The app's cookie prefix. Defaults to AUTH_COOKIE_PREFIX; with neither, every better-auth-shaped cookie sent. */
    cookiePrefix?: string
}

/**
 * Same-origin only: a cross-site POST must not sign a person out. A browser fetch carries `Origin`; with no `Origin`,
 * `Sec-Fetch-Site: same-origin` is required.
 */
export function isSameOriginRequest(request: Request): boolean {
    const origin = request.headers.get('origin')
    if (origin) return origin === new URL(request.url).origin
    return request.headers.get('sec-fetch-site') === 'same-origin'
}

function cookieNamesSent(request: Request): string[] {
    const header = request.headers.get('cookie')
    if (!header) return []
    const names: string[] = []
    for (const part of header.split(';')) {
        const idx = part.indexOf('=')
        const name = (idx === -1 ? part : part.slice(0, idx)).trim()
        if (name) names.push(name)
    }
    return names
}

function expireCookie(name: string, secure: boolean): string {
    const parts = [`${name}=`, 'Path=/', 'Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT', 'SameSite=Lax', 'HttpOnly']
    // A `__Secure-` cookie is only accepted (and so only removed) with Secure.
    if (secure || name.startsWith(SECURE_PREFIX)) parts.push('Secure')
    return parts.join('; ')
}

function resolvePrefix(opts?: SignOutOptions): string | undefined {
    if (opts?.cookiePrefix) return opts.cookiePrefix
    const fromEnv = typeof process !== 'undefined' ? process.env.AUTH_COOKIE_PREFIX?.trim() : undefined
    return fromEnv || undefined
}

/** The `Set-Cookie` values that end this browser's session for one app: plain and `__Secure-` names alike. */
export function signOutCookieHeaders(request: Request, opts?: SignOutOptions): string[] {
    const secure = new URL(request.url).protocol === 'https:'
    const prefix = resolvePrefix(opts)
    const names = new Set(cookieNamesSent(request).filter((n) => isAuthCookieName(n, prefix)))
    // The session token under both names even when the browser did not send it (a stale tab, a half-written cookie).
    const p = prefix ?? authCookiePrefix()
    names.add(`${p}.session_token`)
    if (secure) names.add(`${SECURE_PREFIX}${p}.session_token`)
    return [...names].map((name) => expireCookie(name, secure))
}

/** 204 with every session cookie expired. Never cached. */
export function signOutResponse(request: Request, opts?: SignOutOptions): Response {
    const headers = new Headers({ 'Cache-Control': 'no-store' })
    for (const value of signOutCookieHeaders(request, opts)) headers.append('Set-Cookie', value)
    return new Response(null, { status: 204, headers })
}

/**
 * The background call to better-auth's own sign-out, carrying the ORIGINAL request's headers: its cookies (so it finds
 * and deletes the session row) and its Origin (better-auth's CSRF check).
 */
export function authSignOutRequest(request: Request): Request {
    const url = new URL(request.url)
    const headers = new Headers(request.headers)
    headers.delete('content-length')
    headers.set('content-type', 'application/json')
    if (!headers.has('origin')) headers.set('origin', url.origin)
    return new Request(new URL(AUTH_SIGN_OUT_PATH, url.origin), { method: 'POST', headers, body: '{}' })
}
