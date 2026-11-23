// Renders one @repo/legal document: neutral, readable, max-w-3xl. Server component (react-markdown renders on the
// server; no client JS beyond the links).
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AppLink } from '@repo/ui/components/app-link'
import { SITE } from '@repo/core/site'
import { getLegalDocument, listLegalDocuments, type LegalContext, type LegalDocumentSlug } from '@repo/legal/documents'

/** Replace before launch: the address people write to about terms and privacy, and the operating company. */
export const LEGAL_CONTEXT: LegalContext = {
    productName: SITE.name,
    siteUrl: SITE.url,
    contactEmail: 'legal@example.com',
    companyName: undefined,
}

const components: Components = {
    h2: ({ children }) => <h2 className="mt-8 text-base font-semibold text-neutral-900 dark:text-neutral-100">{children}</h2>,
    h3: ({ children }) => <h3 className="mt-6 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{children}</h3>,
    p: ({ children }) => <p className="mt-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{children}</p>,
    ul: ({ children }) => <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{children}</ul>,
    ol: ({ children }) => <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">{children}</ol>,
    strong: ({ children }) => <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{children}</strong>,
    a: ({ href, children }) => (
        <a href={href} className="cursor-pointer text-neutral-900 underline underline-offset-2 dark:text-neutral-100">{children}</a>
    ),
}

function formatDate(iso: string): string {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
}

export function LegalDocumentPage({ slug }: { slug: LegalDocumentSlug }) {
    const doc = getLegalDocument(slug, LEGAL_CONTEXT)
    const others = listLegalDocuments().filter((d) => d.slug !== slug)
    return (
        <main className="min-h-dvh bg-white dark:bg-[#121314]">
            <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
                <AppLink href="/" className="cursor-pointer text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                    Back to {SITE.name}
                </AppLink>
                <h1 className="mt-6 text-xl font-semibold text-neutral-900 dark:text-neutral-100">{doc.title}</h1>
                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                    Effective {formatDate(doc.effectiveDate)} - version {doc.version}
                </p>
                {doc.template ? (
                    <p className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                        <strong className="font-semibold">Template text.</strong> Replace this document with terms reviewed for your product in packages/legal/src/documents.ts,
                        then set template to false.
                    </p>
                ) : null}
                <article className="mt-6 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{doc.markdown}</ReactMarkdown>
                </article>
                {others.length > 0 ? (
                    <nav className="mt-10 flex flex-wrap gap-4 border-t border-neutral-200 pt-4 text-xs dark:border-neutral-800">
                        {others.map((d) => (
                            <AppLink key={d.slug} href={d.path} className="cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                                {d.title}
                            </AppLink>
                        ))}
                    </nav>
                ) : null}
            </div>
        </main>
    )
}
