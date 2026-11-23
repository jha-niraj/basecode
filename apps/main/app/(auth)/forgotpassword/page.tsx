import type { Metadata } from 'next'
import { param, type SearchParams } from '../_lib/params'
import { ForgotForm } from './_components/forgot-form'

export const metadata: Metadata = {
    title: 'Reset your password',
    description: 'Get a link to choose a new password.',
    robots: { index: false, follow: false },
}

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
    const sp = await searchParams
    return <ForgotForm initialEmail={param(sp, 'email') ?? ''} />
}
