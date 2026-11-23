import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@repo/auth'
import { getSession } from '@repo/auth/next'
import { db, eq } from '@repo/db'
import { account, user } from '@repo/db/schema'
import { isResolvedStorageValue, isStorageConfigured, storageHref } from '@repo/storage'
import type { ProfileData, ProfileSessionRow } from '@/types/profile'
import { ProfileView } from './_components/profile-view'
import { PROFILE_TABS, type ProfileTab } from './_components/tabs'

export const metadata: Metadata = { title: 'Profile' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * The person's own record is read FRESH from the database (the session cookie cache can be 5 minutes behind a name
 * just saved); the account list and the device list in the same round of parallel reads.
 */
export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
    const session = await getSession()
    if (!session) redirect('/signin?stale=1&returnTo=/profile')
    const sp = await searchParams
    const rawTab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab
    const tab: ProfileTab = PROFILE_TABS.some((t) => t.value === rawTab) ? (rawTab as ProfileTab) : 'profile'

    const h = await headers()
    const [rows, accounts, sessions] = await Promise.all([
        db.select({ name: user.name, email: user.email, bio: user.bio, image: user.image, emailVerified: user.emailVerified, createdAt: user.createdAt }).from(user).where(eq(user.id, session.user.id)).limit(1),
        db.select({ providerId: account.providerId, password: account.password }).from(account).where(eq(account.userId, session.user.id)),
        auth.api.listSessions({ headers: h }).catch((err: unknown) => {
            console.error('[profile] listSessions failed:', err)
            return null
        }),
    ])
    const me = rows[0]
    if (!me) redirect('/signin?stale=1')

    const profile: ProfileData = {
        id: session.user.id,
        name: me.name,
        email: me.email,
        bio: me.bio ?? '',
        avatarSrc: storageHref(me.image),
        hasUploadedAvatar: Boolean(me.image && !isResolvedStorageValue(me.image)),
        hasPassword: accounts.some((a) => a.providerId === 'credential' && Boolean(a.password)),
        providers: [...new Set(accounts.map((a) => a.providerId))],
        storageReady: isStorageConfigured(),
        emailVerified: me.emailVerified,
        createdAt: me.createdAt.toISOString(),
    }

    const deviceRows: ProfileSessionRow[] | null = sessions
        ? sessions
            .map((s) => ({
                id: s.id,
                userAgent: s.userAgent ?? null,
                ipAddress: s.ipAddress ?? null,
                createdAt: new Date(s.createdAt).toISOString(),
                updatedAt: new Date(s.updatedAt).toISOString(),
                current: s.id === session.session.id,
            }))
            .sort((a, b) => (a.current === b.current ? b.updatedAt.localeCompare(a.updatedAt) : a.current ? -1 : 1))
        : null

    return <ProfileView initialTab={tab} profile={profile} sessions={deviceRows} />
}
