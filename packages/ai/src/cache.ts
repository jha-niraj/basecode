import type { ModelMessage, SystemModelMessage } from 'ai'

/**
 * PROMPT CACHING - a prefix match in the order tools -> system -> messages. Any byte change in the prefix invalidates
 * everything after it, so:
 * - the system prompt and the tools are FROZEN text (no dates, names, ids, counts) in a fixed order;
 * - per-turn context (who, which page, today's date) goes AFTER the history as a mid-conversation system message
 *   (Haiku 5.5 / Sonnet 5.5 / Opus 5.5 accept `role: 'system'` after a user message; @ai-sdk/anthropic 4 sends it
 *   as one and adds its beta header itself);
 * - three breakpoints: the static start (1-hour TTL - tools + system, the same for everyone), the last user message
 *   (5 min), the latest tool result of this turn (5 min). The 1-hour mark comes first, as Anthropic requires longer
 *   TTLs before shorter ones.
 * Verify with numbers: `[ai cache] step` must show read > 0 from the second request on.
 */

const EPHEMERAL_5M = { type: 'ephemeral' } as const
const EPHEMERAL_1H = { type: 'ephemeral', ttl: '1h' } as const

/** The static start: the system prompt, marked for the 1-hour cache (it also caches the tools in front of it). */
export function cachedInstructions(text: string): SystemModelMessage {
    return { role: 'system', content: text, providerOptions: { anthropic: { cacheControl: EPHEMERAL_1H } } }
}

function withoutMark<M extends ModelMessage>(m: M): M {
    const anthropic = m.providerOptions?.anthropic
    if (!anthropic || !('cacheControl' in anthropic)) return m
    const rest = { ...anthropic }
    delete rest.cacheControl
    return { ...m, providerOptions: { ...m.providerOptions, anthropic: rest } }
}

function withMark<M extends ModelMessage>(m: M): M {
    return { ...m, providerOptions: { ...m.providerOptions, anthropic: { ...m.providerOptions?.anthropic, cacheControl: EPHEMERAL_5M } } }
}

/**
 * Re-mark a message list: clear every message-level mark, then mark the last user message and the latest tool result
 * after it. Idempotent - called before every step (prepareStep), so marks never pile up past the 4-breakpoint limit.
 */
export function withCacheMarks(messages: ModelMessage[]): ModelMessage[] {
    const out = messages.map(withoutMark)
    let lastUser = -1
    for (let i = out.length - 1; i >= 0; i--) {
        if (out[i]!.role === 'user') { lastUser = i; break }
    }
    if (lastUser !== -1) out[lastUser] = withMark(out[lastUser]!)
    for (let i = out.length - 1; i > lastUser; i--) {
        if (out[i]!.role === 'tool') { out[i] = withMark(out[i]!); break }
    }
    return out
}

/** The per-turn block, placed after the user message it belongs to. Empty text = no block. */
export function turnContextMessage(text: string): SystemModelMessage | null {
    const trimmed = text.trim()
    return trimmed ? { role: 'system', content: trimmed } : null
}
