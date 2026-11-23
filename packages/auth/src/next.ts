/**
 * Server-side session reads and the auth route glue for Next. Server only (reads `next/headers`).
 *
 * - `getSession()` - React-cached: one read per request however many layouts, pages and guards ask. better-auth
 *   answers from the signed cookie cache (5 min) with no database on a hit.
 * - `getFreshSession()` - skips the cookie cache. Use it for writes and admin gates, where a 5-minute-old role or
 *   active flag is not good enough.
 * - `requireSession()` - the session or a THROWN AppError('auth'); for server actions (guards throw, never return).
 * - `toNextJsHandler`, `signOutTwin` - for `app/api/auth/[...all]/route.ts` and `app/api/auth/app-sign-out/route.ts`.
 */
import { cache } from 'react'
import { headers } from 'next/headers'
import { AppError } from '@repo/errors'
import { auth, type Session } from './server'
import { isSameOriginRequest, signOutResponse } from './sign-out'

export { toNextJsHandler } from 'better-auth/next-js'

/**
 * null ONLY when there is no session. A failure to READ the session (a database blip, a missing column after a deploy)
 * throws, so the error boundary offers Retry. Treating it as "signed out" sent people to /signin?stale=1, which clears
 * the cookie - one cold start or schema slip signed everybody out (found 2026-11-23).
 */
export const getSession = cache(async (): Promise<Session | null> => {
    try {
        return await auth.api.getSession({ headers: await headers() })
    } catch (err) {
        console.error('[auth] getSession failed:', err)
        throw err
    }
})

export async function getFreshSession(): Promise<Session | null> {
    return auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } })
}

/** The session, or throws AppError('auth'). Every 'use server' export checks the session itself. */
export async function requireSession(opts?: { fresh?: boolean }): Promise<Session> {
    const session = opts?.fresh ? await getFreshSession() : await getSession()
    if (!session) throw new AppError('auth', 'Your session has ended. Sign in again.')
    return session
}

/**
 * `POST /api/sign-out` inside Next - the twin of worker.ts, for `next dev` (where worker.ts does not run; next.config.js
 * rewrites the path to `/api/auth/app-sign-out`). better-auth's sign-out is awaited here (no `waitUntil`), then every
 * session cookie is expired.
 */
export async function signOutTwin(request: Request): Promise<Response> {
    if (!isSameOriginRequest(request)) return new Response(null, { status: 403 })
    try {
        await auth.api.signOut({ headers: request.headers })
    } catch (err) {
        // No session (ended in another tab) or a database blip: the cookies are expired below either way.
        console.error('[sign-out] better-auth sign-out failed (cookies cleared anyway):', err)
    }
    return signOutResponse(request)
}
