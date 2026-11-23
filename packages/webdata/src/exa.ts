// @repo/webdata - Exa web search over fetch (EXA_API_KEY).
import { AppError } from '@repo/errors'
import { envKey, postJson } from './http'

export interface ExaSearchOptions {
    /** 1-25, default 5. */
    numResults?: number
    /** Only these domains (`['docs.stripe.com']`). */
    includeDomains?: string[]
    excludeDomains?: string[]
    /** Exa category hint: 'news', 'company', 'research paper', 'pdf', 'github', ... */
    category?: string
    /** Page text per result, characters. Default 1,500; 0 = no text. */
    maxChars?: number
    /** Ask Exa for a short summary of each result, steered by this question. */
    summaryQuery?: string
    /** ISO date: only pages published after it. */
    startPublishedDate?: string
    /** Override EXA_API_KEY (a Worker env binding). */
    apiKey?: string
    timeoutMs?: number
}

export interface ExaResult {
    url: string
    title: string
    /** Page text, capped at `maxChars`. */
    text: string
    summary: string | null
    publishedDate: string | null
    author: string | null
}

/** True when EXA_API_KEY is set. */
export function isExaConfigured(): boolean {
    return Boolean(envKey('EXA_API_KEY'))
}

/**
 * Search the web. Returns results with page text inline (one request). Throws AppError: ratelimit / network (retryable),
 * quota, or unknown (missing or rejected key). Exa bills each call - do not fan out more queries than you need.
 */
export async function exaSearch(query: string, opts: ExaSearchOptions = {}): Promise<ExaResult[]> {
    const apiKey = opts.apiKey?.trim() || envKey('EXA_API_KEY')
    if (!apiKey) throw new AppError('unknown', 'Web search is not configured (EXA_API_KEY is not set).')
    const q = query.trim()
    if (!q) throw new AppError('validation', 'Search for something.')

    const contents: Record<string, unknown> = {}
    if ((opts.maxChars ?? 1500) > 0) contents.text = { maxCharacters: opts.maxChars ?? 1500 }
    if (opts.summaryQuery) contents.summary = { query: opts.summaryQuery }
    const body: Record<string, unknown> = {
        query: q,
        numResults: Math.min(Math.max(Math.round(opts.numResults ?? 5), 1), 25),
        type: 'auto',
        ...(Object.keys(contents).length ? { contents } : {}),
        ...(opts.includeDomains?.length ? { includeDomains: opts.includeDomains } : {}),
        ...(opts.excludeDomains?.length ? { excludeDomains: opts.excludeDomains } : {}),
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.startPublishedDate ? { startPublishedDate: opts.startPublishedDate } : {}),
    }
    const data = await postJson<{
        results?: Array<{ url?: string; title?: string | null; text?: string; summary?: string; publishedDate?: string | null; author?: string | null }>
    }>('Web search', 'https://api.exa.ai/search', { 'x-api-key': apiKey }, body, opts.timeoutMs ?? 20_000)

    return (data.results ?? [])
        .filter((r): r is typeof r & { url: string } => typeof r.url === 'string' && r.url.length > 0)
        .map((r) => ({
            url: r.url,
            title: r.title ?? '',
            text: r.text ?? '',
            summary: r.summary ?? null,
            publishedDate: r.publishedDate ?? null,
            author: r.author ?? null,
        }))
}

/** Hostname without `www.`, or null. */
export function domainOf(url: string): string | null {
    try {
        return new URL(url).hostname.replace(/^www\./, '').toLowerCase() || null
    } catch {
        return null
    }
}
