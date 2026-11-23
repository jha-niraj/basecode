/**
 * Cookie names, IMPORT-FREE (no better-auth, no Next): the middleware (edge) and worker.ts (outside the Next bundle)
 * both load it.
 *
 * Each app has its OWN cookie prefix (AUTH_COOKIE_PREFIX - set per app in next.config.js `env`, so the same literal is
 * inlined into the server, the middleware and the auth config). Two apps on localhost share every cookie by host name
 * (ports don't separate cookies); with one shared prefix, signing out of admin deleted main's session, and a sign-in on
 * one replaced the other's.
 *
 * better-auth writes `__Secure-<prefix>.session_token` when the base URL is https and `<prefix>.session_token` on plain
 * http (local dev). Readers accept BOTH, always.
 */

/** The fallback when AUTH_COOKIE_PREFIX is not set. Set it per app; two apps on one host must differ. */
export const DEFAULT_COOKIE_PREFIX = 'app'

export const SECURE_PREFIX = '__Secure-'

/** This app's better-auth cookie prefix. `process.env.AUTH_COOKIE_PREFIX` is written out literally so Next inlines it. */
export function authCookiePrefix(): string {
    const fromEnv = typeof process !== 'undefined' ? process.env.AUTH_COOKIE_PREFIX : undefined
    return fromEnv?.trim() || DEFAULT_COOKIE_PREFIX
}

/** `<prefix>.session_token` and `__Secure-<prefix>.session_token`. */
export function sessionCookieNames(prefix: string = authCookiePrefix()): [plain: string, secure: string] {
    const plain = `${prefix}.session_token`
    return [plain, `${SECURE_PREFIX}${plain}`]
}

/** Every cookie better-auth may write for a prefix, bare (no `__Secure-`): the session, its cache chunks, flags. */
export function isAuthCookieName(name: string, prefix?: string): boolean {
    const bare = name.startsWith(SECURE_PREFIX) ? name.slice(SECURE_PREFIX.length) : name
    if (prefix) return bare.startsWith(`${prefix}.`)
    // No prefix known (worker.ts without AUTH_COOKIE_PREFIX): anything shaped like a better-auth session cookie.
    return /^[^.]+\.(session_token|session_data(\.\d+)?|dont_remember|account_data(\.\d+)?)$/.test(bare)
}

interface CookieReader {
    get(name: string): { value: string } | undefined
}

/** True when the request carries this app's session cookie (either name). Says nothing about whether it is valid. */
export function hasSessionCookie(cookies: CookieReader, prefix: string = authCookiePrefix()): boolean {
    const [plain, secure] = sessionCookieNames(prefix)
    return Boolean(cookies.get(secure)?.value || cookies.get(plain)?.value)
}
