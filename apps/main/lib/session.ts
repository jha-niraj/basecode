import "server-only"
// Server only: reads next/headers through @repo/auth/next.
import { cache } from 'react'
import { getSession as getAuthSession, requireSession as requireAuthSession } from '@repo/auth/next'
import type { Session } from '@repo/auth'
import { storageHref } from '@repo/storage'
import type { AppSession } from '@/types/session'

/**
 * The session for pages, layouts and server actions - read ONCE per request (React `cache`; better-auth answers from
 * the signed cookie cache with no database on a hit). The avatar is resolved to an href here, so no caller renders a
 * raw R2 key. Server actions that write use `requireSession()` (throws AppError('auth')); pass `{ fresh: true }` when
 * a 5-minute-old cached session is not good enough.
 */
function shape(s: Session): AppSession {
    const u = s.user
    return {
        session: { id: s.session.id, expiresAt: new Date(s.session.expiresAt) },
        user: {
            id: u.id,
            name: u.name,
            email: u.email,
            image: storageHref(u.image ?? null),
            role: typeof u.role === 'string' ? u.role : 'USER',
            emailVerified: u.emailVerified,
            bio: typeof u.bio === 'string' ? u.bio : null,
        },
    }
}

export const getSession = cache(async (): Promise<AppSession | null> => {
    const s = await getAuthSession()
    return s ? shape(s) : null
})

export async function requireSession(opts?: { fresh?: boolean }): Promise<AppSession> {
    return shape(await requireAuthSession(opts))
}

/** The raw better-auth session (stored image KEY, not an href) - for the profile's own writes. */
export async function requireRawSession(opts?: { fresh?: boolean }): Promise<Session> {
    return requireAuthSession(opts)
}
