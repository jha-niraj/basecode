import type { Metadata } from 'next'
import { safeReturnTo } from '@repo/auth/return-to'
import { authErrorMessage } from '@repo/auth/errors'
import { AdminAuthFrame } from './_components/admin-auth-frame'
import { AdminSignIn, type AdminNotice } from './_components/admin-signin'

export const metadata: Metadata = {
    title: 'Admin sign in',
    description: 'Sign in to the admin console.',
    robots: { index: false, follow: false },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function param(sp: Record<string, string | string[] | undefined>, key: string): string | null {
    const v = sp[key]
    const s = (Array.isArray(v) ? v[0] : v)?.trim()
    return s ? s : null
}

/** The admin landing IS the sign-in: the frame's right panel says what this is, the left signs in. */
export default async function AdminLandingPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams
    const error = param(sp, 'error')
    let notice: AdminNotice | null = null
    if (error) notice = { tone: 'error', text: authErrorMessage(error) }
    else if (param(sp, 'stale')) notice = { tone: 'neutral', text: 'Your session ended. Sign in again to carry on.' }
    else if (param(sp, 'denied')) notice = { tone: 'error', text: 'This account has no admin access. Ask a super admin for an invitation.' }

    return (
        <AdminAuthFrame panelTitle="Run the platform from one place." panelLine="Team, access, users, audit and system settings - for people with admin access only.">
            <AdminSignIn returnTo={safeReturnTo(param(sp, 'returnTo') ?? param(sp, 'callbackUrl'), '/home')} notice={notice} />
        </AdminAuthFrame>
    )
}
