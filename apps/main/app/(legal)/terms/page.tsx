import type { Metadata } from 'next'
import { listLegalDocuments } from '@repo/legal/documents'
import { LegalDocumentPage } from '../_components/legal-document'

const meta = listLegalDocuments().find((d) => d.slug === 'terms')

export const metadata: Metadata = {
    title: meta?.title ?? 'Terms of Service',
    description: meta?.summary,
}

export default function TermsPage() {
    return <LegalDocumentPage slug="terms" />
}
