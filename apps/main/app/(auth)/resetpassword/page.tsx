import type { Metadata } from 'next'
import { param, type SearchParams } from '../_lib/params'
import { ResetForm } from './_components/reset-form'

export const metadata: Metadata = {
    title: 'Choose a new password',
    description: 'Choose a new password for your account.',
    robots: { index: false, follow: false },
}

/** The reset link lands here with `?token=` (or `?error=INVALID_TOKEN` when better-auth refused it). */
export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams
    const token = param(sp, 'token')
    return <ResetForm token={param(sp, 'error') ? null : token} />
}
