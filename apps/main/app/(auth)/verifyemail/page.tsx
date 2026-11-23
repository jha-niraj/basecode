import type { Metadata } from 'next'
import { authErrorMessage } from '@repo/auth/errors'
import { getSession } from '@/lib/session'
import { param, type SearchParams } from '../_lib/params'
import { VerifyEmail } from './_components/verify-email'

export const metadata: Metadata = {
    title: 'Confirm your email',
    description: 'Confirm your email address.',
    robots: { index: false, follow: false },
}

/**
 * Two states: after sign-up ("check your inbox", resend), and where the link lands (`?done=1`, plus `?error=` from
 * better-auth when the token is bad or expired). A good link signs the person in, so "done" offers Continue.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams
    const done = Boolean(param(sp, 'done'))
    const error = param(sp, 'error')
    const session = done && !error ? await getSession() : null
    return (
        <VerifyEmail
            state={done ? (error ? 'failed' : 'done') : 'sent'}
            error={error ? authErrorMessage(error) : null}
            email={param(sp, 'email') ?? session?.user.email ?? ''}
            resent={Boolean(param(sp, 'resent'))}
            signedIn={Boolean(session)}
        />
    )
}
