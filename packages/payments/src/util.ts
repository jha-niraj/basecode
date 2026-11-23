// @repo/payments - small shared helpers: env reads, Web Crypto HMAC (Workers-safe, no node:crypto), constant-time
// compare, minor-unit formatting, and a JSON fetch that tells "the gateway said no" from "we could not reach it".
import { PaymentError, type ProviderId, type ReturnHint } from './types'

/** An env value, trimmed; whitespace-only counts as missing. Read at call time, never at import. */
export function readEnv(name: string): string | undefined {
    const v = process.env[name]?.trim()
    return v ? v : undefined
}

/** The value, or a PaymentError naming the missing variable. */
export function requireEnv(name: string, provider: ProviderId): string {
    const v = readEnv(name)
    if (!v) throw new PaymentError('not_configured', `${name} is not set`, { provider })
    return v
}

/** `live` only on an exact `live` / `production`; anything else (blank, `test`, a typo) is the sandbox. */
export function modeFromEnv(name: string): 'test' | 'live' {
    const v = (readEnv(name) ?? '').toLowerCase()
    return v === 'live' || v === 'production' ? 'live' : 'test'
}

/** Constant-time string compare for signatures. Length is fixed by the algorithm, so an early length exit is fine. */
export function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
    const bytes = await hmac(secret, message)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hmacSha256Base64(secret: string, message: string): Promise<string> {
    const bytes = await hmac(secret, message)
    let binary = ''
    for (const b of bytes) binary += String.fromCharCode(b)
    return btoa(binary)
}

export async function sha256Hex(message: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message))
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Minor units to the decimal a JSON API wants (Cashfree): 59900 -> 599, 59950 -> 599.5. Integer math, one division. */
export function minorToMajor(minor: number): number {
    return Math.round(minor) / 100
}

/** A gateway's decimal amount back to minor units, rounded once. Null when it is not a number. */
export function majorToMinor(v: unknown): number | null {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(/,/g, '')) : NaN
    return Number.isFinite(n) ? Math.round(n * 100) : null
}

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null)

export interface JsonResponse {
    status: number
    body: unknown
}

/**
 * fetch + JSON that never confuses a network failure with a declined payment: an unreachable gateway throws
 * PaymentError('unreachable'); any HTTP answer (even 4xx / 5xx) comes back as `{ status, body }` for the caller.
 */
export async function fetchJson(provider: ProviderId, url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<JsonResponse> {
    let res: Response
    try {
        res = await fetch(url, { method: init.method, headers: init.headers, ...(init.body !== undefined ? { body: init.body } : {}) })
    } catch (err) {
        throw new PaymentError('unreachable', `Could not reach ${provider}. Try again in a minute.`, { provider, cause: err })
    }
    const text = await res.text().catch(() => '')
    let body: unknown = null
    try { body = text ? JSON.parse(text) : null } catch { body = text.slice(0, 500) }
    return { status: res.status, body }
}

/** The gateway's own error sentence from a JSON error body, for logs (never shown raw). */
export function gatewayMessage(body: unknown): string {
    if (!isObj(body)) return typeof body === 'string' ? body.slice(0, 300) : 'no body'
    const e = isObj(body.error) ? body.error : body
    return str(e.description) ?? str(e.message) ?? str(e.detail) ?? str(body.message) ?? JSON.stringify(body).slice(0, 300)
}

/** Throws PaymentError('gateway') for a non-2xx answer, naming the status. */
export function expectOk(provider: ProviderId, res: JsonResponse, what: string): Record<string, unknown> {
    if (res.status < 200 || res.status >= 300 || !isObj(res.body)) {
        console.error(`[payments:${provider}] ${what} failed (${res.status}): ${gatewayMessage(res.body)}`)
        throw new PaymentError('gateway', `${labelOf(provider)} could not ${what}. Try again, or pick another way to pay.`, { provider })
    }
    return res.body
}

export function labelOf(provider: ProviderId): string {
    return { esewa: 'eSewa', khalti: 'Khalti', razorpay: 'Razorpay', cashfree: 'Cashfree', stripe: 'Stripe' }[provider]
}

/** Appends query params to a URL that may already have a query or a hash. */
export function withQuery(url: string, params: Record<string, string | number | null | undefined>): string {
    const hashAt = url.indexOf('#')
    const base = hashAt === -1 ? url : url.slice(0, hashAt)
    const hash = hashAt === -1 ? '' : url.slice(hashAt)
    const parts = Object.entries(params)
        .filter((e): e is [string, string | number] => e[1] !== null && e[1] !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    if (!parts.length) return url
    return `${base}${base.includes('?') ? '&' : '?'}${parts.join('&')}${hash}`
}

export function emptyHint(): ReturnHint {
    return { paymentId: null, providerOrderId: null, providerPaymentId: null, providerSubscriptionId: null, cancelled: false, signatureValid: null }
}
