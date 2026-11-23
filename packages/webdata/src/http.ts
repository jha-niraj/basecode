// @repo/webdata - one POST with timeout + bounded retry, shared by the Exa and Firecrawl clients.
import { AppError } from '@repo/errors'

const MAX_ATTEMPTS = 3
const BACKOFF_MS = [250, 500]
/** Honour Retry-After up to this; longer and the caller gets the error instead of a stalled request. */
const MAX_RETRY_AFTER_MS = 10_000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function retryAfterMs(res: Response): number | null {
    const raw = res.headers.get('retry-after')
    if (!raw) return null
    const secs = Number(raw)
    const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(raw) - Date.now()
    return Number.isFinite(ms) && ms > 0 ? Math.min(ms, MAX_RETRY_AFTER_MS) : null
}

function isRetryableNetworkError(err: unknown): boolean {
    if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) return true
    return err instanceof TypeError
}

/**
 * Map a failed status to an AppError. A rejected API key is deliberately NOT 'auth' (that kind sends the user to
 * sign-in; a bad server key is our problem). 402 = the provider plan is out of credit ('quota', needs an operator).
 */
function classify(service: string, status: number, body: string): AppError {
    const cause = new Error(`${service} HTTP ${status}: ${body.slice(0, 200)}`)
    if (status === 429) return new AppError('ratelimit', `${service} is rate limited right now. Try again in a moment.`, { cause })
    if (status === 402) return new AppError('quota', `${service} is out of credits. An admin needs to top it up.`, { cause })
    if (status >= 500) return new AppError('network', `${service} is temporarily unavailable. Try again in a moment.`, { cause })
    if (status === 401 || status === 403) return new AppError('unknown', `${service} rejected the API key.`, { cause })
    return new AppError('unknown', `${service} rejected the request (${status}).`, { cause })
}

/** POST JSON; retries 429, 5xx and connection failures (reads only - but note each attempt may be billed). */
export async function postJson<T>(
    service: string,
    url: string,
    headers: Record<string, string>,
    body: unknown,
    timeoutMs: number,
): Promise<T> {
    const payload = JSON.stringify(body)
    for (let attempt = 1; ; attempt++) {
        let res: Response
        try {
            res = await fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json', ...headers },
                body: payload,
                signal: AbortSignal.timeout(timeoutMs),
            })
        } catch (err) {
            if (attempt >= MAX_ATTEMPTS || !isRetryableNetworkError(err)) {
                throw new AppError('network', `Could not reach ${service}. Try again in a moment.`, { cause: err })
            }
            await sleep(BACKOFF_MS[attempt - 1] ?? 1000)
            continue
        }
        if (res.ok) return (await res.json()) as T
        const text = await res.text().catch(() => '')
        const err = classify(service, res.status, text)
        if (attempt >= MAX_ATTEMPTS || !(res.status === 429 || res.status >= 500)) throw err
        await sleep(retryAfterMs(res) ?? BACKOFF_MS[attempt - 1] ?? 1000)
    }
}

/** An env key read at call time (whitespace-only = missing). */
export function envKey(name: string): string | undefined {
    const v = process.env[name]?.trim()
    return v ? v : undefined
}
