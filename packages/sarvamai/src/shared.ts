// @repo/sarvamai - shared plumbing: base URL, key lookup, HTTP error mapping, base64. Not a public entry.
import { AppError } from '@repo/errors'

export const SARVAM_BASE = 'https://api.sarvam.ai'

/** Every call accepts an explicit key (a Worker `env` binding); otherwise SARVAM_API_KEY is read at call time. */
export interface SarvamAuth {
    apiKey?: string
}

/** True when SARVAM_API_KEY is set (whitespace-only counts as missing). Server-only. */
export function isSarvamConfigured(): boolean {
    return Boolean(process.env.SARVAM_API_KEY?.trim())
}

export function sarvamKey(auth?: SarvamAuth): string {
    const key = auth?.apiKey?.trim() || process.env.SARVAM_API_KEY?.trim()
    if (!key) throw new AppError('unknown', 'SARVAM_API_KEY is not set')
    return key
}

/**
 * Map a failed Sarvam response to an AppError. The user message never carries the body (it can echo the input text);
 * the body goes to `cause` for the server log only.
 */
export async function sarvamHttpError(res: Response, what: string): Promise<AppError> {
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    const cause = new Error(`Sarvam ${what} HTTP ${res.status}: ${detail}`)
    if (res.status === 429) return new AppError('ratelimit', `The ${what} service is busy - try again in a moment.`, { cause })
    if (res.status === 402 || res.status === 403) return new AppError('quota', `The ${what} service is out of credit.`, { cause })
    if (res.status === 400 || res.status === 413 || res.status === 422) {
        return new AppError('validation', `The ${what} service could not use that input.`, { cause })
    }
    if (res.status === 401) return new AppError('unknown', `The ${what} service rejected the API key.`, { cause })
    return new AppError('network', `The ${what} service failed - try again.`, { cause })
}

/** fetch with a timeout; a thrown network error becomes a retryable AppError. */
export async function sarvamFetch(url: string, init: RequestInit, what: string, timeoutMs: number): Promise<Response> {
    try {
        return await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) })
    } catch (err) {
        throw new AppError('network', `The ${what} service could not be reached.`, { cause: err })
    }
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Standard base64 -> bytes (`atob` exists in Workers, browsers and Node 16+). */
export function base64ToBytes(base64: string): Uint8Array {
    const bin = atob(base64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
}

/** Bytes -> standard base64, chunked so a large clip does not blow the argument limit. */
export function bytesToBase64(bytes: Uint8Array): string {
    let bin = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    return btoa(bin)
}
