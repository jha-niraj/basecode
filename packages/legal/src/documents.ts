// @repo/legal - the documents, as code: versioned markdown with an effective date. Pure (no database), safe anywhere.
//
// THESE ARE TEMPLATES. Every clone must replace the text with terms its own lawyer has reviewed - each document carries
// `template: true` until then, and the pages show a notice while it is true.
//
// Versioning: bump `version` (an ISO date) ONLY for a material change - every signed-in user is then asked to accept
// again (`needsAcceptance`). Fix a typo without bumping.

export interface LegalContext {
    /** Product name as shown to users. */
    productName: string
    /** The product's public URL (no trailing slash). */
    siteUrl: string
    /** Where people write about privacy and terms. */
    contactEmail: string
    /** The legal entity that operates the product. */
    companyName?: string
}

export const LEGAL_DOCUMENT_SLUGS = ['terms', 'privacy'] as const
export type LegalDocumentSlug = (typeof LEGAL_DOCUMENT_SLUGS)[number]

export interface LegalDocumentMeta {
    slug: LegalDocumentSlug
    title: string
    /** ISO date string - also the version a user accepts. */
    version: string
    /** When this version takes effect (ISO date). */
    effectiveDate: string
    /** One line for metadata and the acceptance prompt. */
    summary: string
    /** The app path the document lives at. */
    path: string
    /** True while the text is the starter template. Replace the text, then set false. */
    template: boolean
}

export interface LegalDocument extends LegalDocumentMeta {
    /** Markdown: `## ` sections, paragraphs, `- ` bullets, `**bold**`, links. */
    markdown: string
}

const META: Record<LegalDocumentSlug, LegalDocumentMeta> = {
    terms: {
        slug: 'terms',
        title: 'Terms of Service',
        version: '2026-11-23',
        effectiveDate: '2026-11-23',
        summary: 'The rules for using the service and what we each agree to.',
        path: '/terms',
        template: true,
    },
    privacy: {
        slug: 'privacy',
        title: 'Privacy Policy',
        version: '2026-11-23',
        effectiveDate: '2026-11-23',
        summary: 'What we collect, why, who we share it with, and your choices.',
        path: '/privacy',
        template: true,
    },
}

function operator(ctx: LegalContext): string {
    return ctx.companyName ? `${ctx.companyName} ("we", "us")` : `the operators of ${ctx.productName} ("we", "us")`
}

const BODY: Record<LegalDocumentSlug, (ctx: LegalContext) => string> = {
    terms: (ctx) => `
These terms are an agreement between you and ${operator(ctx)} for the use of ${ctx.productName} at ${ctx.siteUrl}. By creating an account or using the service you accept them.

## 1. Your account

- You must give accurate information when you sign up and keep it current.
- You are responsible for everything done with your account. Keep your password private and tell us at ${ctx.contactEmail} if you think someone else has used it.
- You must be old enough to agree to these terms where you live.

## 2. Using the service

- Use ${ctx.productName} only for lawful purposes and in line with these terms.
- Do not try to break, overload or get around the security of the service, and do not access other people's data.
- Do not upload content you do not have the right to share, or content that is unlawful or harmful.

## 3. Your content

You keep ownership of what you put into ${ctx.productName}. You give us the permission we need to store, process and display it so the service can work for you. We do not sell your content.

## 4. AI features

Some features use AI models to generate text. Generated output can be wrong; check it before you rely on it. Do not use it as a substitute for professional advice.

## 5. Payments

Paid features are billed as described at the point of purchase. Prices are shown before you pay. Payments are processed by our payment provider; we do not store your card details.

## 6. Ending your account

You can delete your account at any time from your profile. We may suspend or end an account that breaks these terms. When an account is deleted we erase its data as described in the Privacy Policy.

## 7. Disclaimers and liability

The service is provided "as is". To the extent the law allows, we are not liable for indirect or consequential losses, and our total liability is limited to the amount you paid us in the twelve months before the claim.

## 8. Changes

We may update these terms. For a material change we will ask you to accept the new version before you continue using the service.

## 9. Contact

Questions about these terms: ${ctx.contactEmail}.
`,
    privacy: (ctx) => `
This policy explains what ${operator(ctx)} collects when you use ${ctx.productName}, why, and the choices you have.

## 1. What we collect

- **Account details:** your name, email address, password (stored only as a one-way hash) and, if you add one, a profile photo.
- **Sign-in with Google:** your name, email and profile picture from your Google account.
- **What you create:** the content you enter, including conversations with AI features.
- **Usage and device data:** sign-in times, IP address and browser type, used to keep your account secure.
- **Payments:** if you buy something, our payment provider processes your card; we keep a record of the purchase, not the card.

## 2. Why we use it

- To provide the service and keep your account secure.
- To answer you when you contact us.
- To bill you for paid features.
- To improve the service, using aggregated information that does not identify you.

## 3. Who we share it with

We share data only with the providers that run the service for us (hosting, database, email delivery, file storage, payment processing and AI model providers), each under an agreement to protect it and use it only for us. We do not sell your personal data.

## 4. How long we keep it

We keep your data while your account exists. When you delete your account we erase your profile, sign-in records, uploaded files and conversations. We keep a minimal record that the erasure happened, and records the law requires us to keep (such as payment records).

## 5. Your choices

- See and change your details on your profile.
- Delete your account and its data from your profile at any time.
- Ask us for a copy of your data or raise a concern at ${ctx.contactEmail}.

## 6. Cookies

We use cookies that are needed to keep you signed in and to remember settings such as the theme. We do not use advertising cookies.

## 7. Changes

We may update this policy. For a material change we will ask you to accept the new version.

## 8. Contact

Privacy questions: ${ctx.contactEmail}.
`,
}

/** Every document's metadata (current versions), no text. */
export function listLegalDocuments(): LegalDocumentMeta[] {
    return LEGAL_DOCUMENT_SLUGS.map((s) => META[s])
}

/** The current version string of a document. */
export function currentVersion(slug: LegalDocumentSlug): string {
    return META[slug].version
}

export function isLegalDocumentSlug(value: string): value is LegalDocumentSlug {
    return (LEGAL_DOCUMENT_SLUGS as readonly string[]).includes(value)
}

/** One document, filled in with the product's details. */
export function getLegalDocument(slug: LegalDocumentSlug, ctx: LegalContext): LegalDocument {
    return { ...META[slug], markdown: BODY[slug](ctx).trim() }
}
