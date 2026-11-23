/**
 * The middleware's ONE auth question: does this request carry this app's session cookie? Cookie only - never the
 * database, never better-auth (the middleware runs on the edge; OpenNext rejects Node middleware). Whether the session
 * is VALID is the layout's and every server action's job; a stale cookie lands on a page whose server read sends the
 * person to `/signin?stale=1`.
 *
 * IMPORT-FREE apart from ./cookies and ./return-to.
 */
import { hasSessionCookie } from './cookies'
import { safeReturnTo } from './return-to'

export { hasSessionCookie, sessionCookieNames, authCookiePrefix } from './cookies'
export { safeReturnTo } from './return-to'

interface MiddlewareRequest {
    cookies: { get(name: string): { value: string } | undefined }
    nextUrl: { pathname: string; search: string; origin: string; searchParams: URLSearchParams }
}

/** True when this app's session cookie (plain or `__Secure-`) is present. */
export function isSignedIn(request: MiddlewareRequest, prefix?: string): boolean {
    return hasSessionCookie(request.cookies, prefix)
}

/** True when `pathname` is one of `routes` or under one of them. `/` only matches itself. */
export function matchesRoute(pathname: string, routes: readonly string[]): boolean {
    return routes.some((r) => (r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(`${r}/`)))
}

/** `<origin><signInPath>?returnTo=<the page asked for>` - the redirect for a signed-out visitor. */
export function signInRedirectUrl(request: MiddlewareRequest, signInPath: string): URL {
    const url = new URL(signInPath, request.nextUrl.origin)
    const asked = `${request.nextUrl.pathname}${request.nextUrl.search}`
    if (asked && asked !== '/' && request.nextUrl.pathname !== signInPath) url.searchParams.set('returnTo', asked)
    return url
}

/** Where a signed-in visitor on an auth page goes: their `returnTo` when it is safe, else `home`. */
export function signedInRedirectUrl(request: MiddlewareRequest, home: string): URL {
    const dest = safeReturnTo(request.nextUrl.searchParams.get('returnTo'), home)
    return new URL(dest, request.nextUrl.origin)
}
