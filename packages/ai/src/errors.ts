import { APICallError } from 'ai'
import type { ChatErrorCode } from './protocol'

/**
 * Provider error classifier. What the person reads is a plain sentence, never "Connection failed".
 *
 * Retry policy (owner, 2026-11-23): overloaded -> retry once; quota / auth / invalid -> fatal, no retry.
 * The one retry happens in the SDK (`maxRetries: 1` on the call: it retries 408/409/429/5xx, Anthropic's overloaded is
 * 529) before any output was streamed. An error in the middle of a stream is not retried - partial text cannot be
 * taken back - and is reported with the sentence below.
 */
export interface ClassifiedAiError {
    code: ChatErrorCode
    retryable: boolean
    message: string
}

const MESSAGES: Record<ChatErrorCode, string> = {
    cap: 'You have reached today\'s AI limit. It resets at midnight UTC.',
    overloaded: 'The AI service is busy right now. Try again in a minute.',
    rate_limit: 'Too many requests at once. Wait a few seconds and try again.',
    quota: 'The AI account is out of credit. Ask the person who runs this app to top it up.',
    auth: 'The AI service rejected this app\'s key. Ask the person who runs this app to check ANTHROPIC_API_KEY.',
    invalid: 'The AI service could not read that request. Start a new chat and try again.',
    not_configured: 'AI is not set up on this app yet (ANTHROPIC_API_KEY is missing).',
    unknown: 'Something went wrong while answering. Try again.',
}

export function aiErrorMessage(code: ChatErrorCode): string {
    return MESSAGES[code]
}

function bodyText(err: APICallError): string {
    return `${err.responseBody ?? ''} ${err.message}`.toLowerCase()
}

export function classifyAiError(err: unknown): ClassifiedAiError {
    // A retry wrapper (RetryError) keeps the last attempt's error.
    const inner = typeof err === 'object' && err !== null && 'lastError' in err ? (err as { lastError: unknown }).lastError : err
    if (APICallError.isInstance(inner)) {
        const status = inner.statusCode ?? 0
        const text = bodyText(inner)
        let code: ChatErrorCode = 'unknown'
        if (status === 529 || text.includes('overloaded')) code = 'overloaded'
        else if (text.includes('credit balance') || text.includes('billing') || status === 402) code = 'quota'
        else if (status === 429) code = 'rate_limit'
        else if (status === 401 || status === 403) code = 'auth'
        else if (status === 400 || status === 413 || status === 422) code = 'invalid'
        else if (status >= 500) code = 'overloaded'
        return { code, retryable: code === 'overloaded' || code === 'rate_limit', message: MESSAGES[code] }
    }
    const text = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
    if (text.includes('anthropic_api_key is not set')) return { code: 'not_configured', retryable: false, message: MESSAGES.not_configured }
    if (text.includes('overloaded')) return { code: 'overloaded', retryable: true, message: MESSAGES.overloaded }
    return { code: 'unknown', retryable: false, message: MESSAGES.unknown }
}
