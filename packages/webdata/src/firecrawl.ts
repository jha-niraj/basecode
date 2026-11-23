// @repo/webdata - Firecrawl scrape (one URL -> clean markdown) and map (a site's URLs) over fetch (FIRECRAWL_API_KEY).
import { AppError } from '@repo/errors'
import { envKey, postJson } from './http'

const BASE = 'https://api.firecrawl.dev/v2'

export interface FirecrawlScrapeOptions {
    /** Default ['markdown']. 'summary' and 'links' are extra; `json` extraction is not exposed here (5x the credits). */
    formats?: Array<'markdown' | 'html' | 'links' | 'summary'>
    /** Strip nav, footers and boilerplate. Default true. */
    onlyMainContent?: boolean
    /** Serve a cached copy fetched within this many ms (cheaper, faster). Never on a change-detection read. */
    maxAge?: number
    /**
     * Cap the pages parsed from a PDF. Firecrawl bills a PDF per PAGE, so any URL a user can supply should set this.
     * Default 10.
     */
    pdfMaxPages?: number
    apiKey?: string
    timeoutMs?: number
}

export interface FirecrawlScrapeResult {
    url: string
    markdown: string
    html: string | null
    links: string[]
    summary: string | null
    title: string | null
    description: string | null
    statusCode: number | null
}

/** True when FIRECRAWL_API_KEY is set. */
export function isFirecrawlConfigured(): boolean {
    return Boolean(envKey('FIRECRAWL_API_KEY'))
}

function key(opts: { apiKey?: string }): string {
    const k = opts.apiKey?.trim() || envKey('FIRECRAWL_API_KEY')
    if (!k) throw new AppError('unknown', 'Web page fetching is not configured (FIRECRAWL_API_KEY is not set).')
    return k
}

function assertHttpUrl(url: string): void {
    let u: URL
    try {
        u = new URL(url)
    } catch {
        throw new AppError('validation', 'That is not a valid web address.')
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new AppError('validation', 'Only http and https pages can be read.')
}

/** Fetch one page as clean data (1 credit; PDFs 1 per page up to `pdfMaxPages`). Throws AppError on failure. */
export async function firecrawlScrape(url: string, opts: FirecrawlScrapeOptions = {}): Promise<FirecrawlScrapeResult> {
    const apiKey = key(opts)
    assertHttpUrl(url)
    const body: Record<string, unknown> = {
        url,
        formats: opts.formats ?? ['markdown'],
        onlyMainContent: opts.onlyMainContent ?? true,
        parsers: [{ type: 'pdf', maxPages: opts.pdfMaxPages ?? 10 }],
        ...(opts.maxAge !== undefined ? { maxAge: opts.maxAge } : {}),
    }
    const res = await postJson<{
        success?: boolean
        error?: string
        data?: {
            markdown?: string
            html?: string
            links?: string[]
            summary?: string
            metadata?: { title?: string; description?: string; sourceURL?: string; statusCode?: number }
        }
    }>('Web page fetching', `${BASE}/scrape`, { authorization: `Bearer ${apiKey}` }, body, opts.timeoutMs ?? 45_000)
    // A 200 with success:false is a page-level refusal (blocked, not found) - never an empty "blank page".
    if (!res.data) throw new AppError('unknown', res.error ? `Could not read that page: ${res.error.slice(0, 200)}` : 'Could not read that page.')
    const d = res.data
    return {
        url: d.metadata?.sourceURL ?? url,
        markdown: d.markdown ?? '',
        html: d.html ?? null,
        links: d.links ?? [],
        summary: d.summary ?? null,
        title: d.metadata?.title ?? null,
        description: d.metadata?.description ?? null,
        statusCode: d.metadata?.statusCode ?? null,
    }
}

export interface FirecrawlMapLink {
    url: string
    title?: string
    description?: string
}

/** List a site's URLs (1 credit however many come back) - map, then scrape only the pages you need. */
export async function firecrawlMap(
    url: string,
    opts: { search?: string; limit?: number; apiKey?: string; timeoutMs?: number } = {},
): Promise<FirecrawlMapLink[]> {
    const apiKey = key(opts)
    assertHttpUrl(url)
    const res = await postJson<{ links?: Array<FirecrawlMapLink | string> }>(
        'Web page fetching',
        `${BASE}/map`,
        { authorization: `Bearer ${apiKey}` },
        { url, ...(opts.search ? { search: opts.search } : {}), ...(opts.limit !== undefined ? { limit: opts.limit } : {}) },
        opts.timeoutMs ?? 30_000,
    )
    return (res.links ?? []).map((l) => (typeof l === 'string' ? { url: l } : l)).filter((l) => Boolean(l.url))
}
