// @repo/pdf - one filename convention for every generated document, and the HTTP response that serves one.

/** Lowercase ASCII, hyphen-separated; non-Latin text slugs to empty (the name still lives inside the document). */
export function slugifyForFilename(value: string, maxLength = 40): string {
    return value
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, maxLength)
        .replace(/-+$/, '')
}

export interface PdfFilenameInput {
    /** e.g. "users", "invoice", "statement". */
    type: string
    /** What identifies this one: a customer name, an invoice number, a period. */
    subject?: string | null
    /** Product or tenant prefix ("acme"). */
    prefix?: string | null
    /** Defaults to now; written as YYYY-MM-DD (UTC). */
    at?: Date
}

/**
 * `<prefix>-<type>-<subject>-<YYYY-MM-DD>.pdf`. Date LAST so a folder sorted by name groups by type and subject; a
 * download folder of `document (3).pdf` is what happens otherwise.
 */
export function pdfFilename(input: PdfFilenameInput): string {
    const date = (input.at ?? new Date()).toISOString().slice(0, 10)
    const parts = [
        input.prefix ? slugifyForFilename(input.prefix, 30) : '',
        slugifyForFilename(input.type, 30),
        input.subject ? slugifyForFilename(input.subject, 30) : '',
        date,
    ]
    return `${parts.filter(Boolean).join('-')}.pdf`
}

/** A Response for PDF bytes: inline by default (opens in the tab), `download: true` saves it. Never cached publicly. */
export function pdfResponse(bytes: Uint8Array, filename: string, opts: { download?: boolean } = {}): Response {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '-')
    return new Response(bytes as unknown as BodyInit, {
        headers: {
            'content-type': 'application/pdf',
            'content-disposition': `${opts.download ? 'attachment' : 'inline'}; filename="${safe}"`,
            'cache-control': 'private, no-store',
            'x-content-type-options': 'nosniff',
        },
    })
}
