import 'server-only'
import { createAnthropic } from '@ai-sdk/anthropic'
import type { AnthropicLanguageModelOptions } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'
import { taskConfig, type AiTaskName } from './config'

/**
 * The Anthropic model for a task, plus the provider options that go with it.
 *
 * THINKING (owner, 2026-11-23): adaptive on every task, the SAME on every turn - never switched per message, because a
 * change to thinking or effort invalidates the whole cached prefix (measured in an earlier project). Effort comes from the task.
 * For the record, if a project ever needs thinking OFF:
 *   - Haiku 5.5: `{ type: 'disabled' }` (only at effort high or below). @ai-sdk/anthropic 4.x sends it through (it did
 *     NOT in v5 - an earlier project re-added it in a fetch wrapper).
 *   - Sonnet 5.5: `disabled` is a 400; its lowest setting is `{ type: 'between_tools' }`.
 *   - Opus 5.5: cannot turn thinking off at all; lower effort instead.
 */
export function thinkingFor(): NonNullable<AnthropicLanguageModelOptions['thinking']> {
    return { type: 'adaptive' }
}

/** Provider options for a task: thinking + effort. Pass as `providerOptions: { anthropic: ... }`. */
export function anthropicOptionsFor(task: AiTaskName) {
    const cfg = taskConfig(task)
    return { thinking: thinkingFor(), effort: cfg.effort } satisfies AnthropicLanguageModelOptions
}

const isDev = process.env.NODE_ENV !== 'production'

/** A short, stable fingerprint of a string, so two requests can be compared in the dev log. */
function fingerprint(text: string): string {
    let h = 5381
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
    return (h >>> 0).toString(36)
}

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * A fetch wrapper around the provider's request:
 * 1. Drops the JSON Schema `$schema` line from every tool's input schema (~50 characters per tool Claude never uses).
 *    Deterministic, so the cached tools prefix is unchanged between requests.
 * 2. Dev only: prints `[ai cache] request` with a fingerprint of the tools, the system prompt and the message count -
 *    when cache reads stay at 0, compare two consecutive lines: whatever fingerprint changed is the invalidator.
 * Sent ONCE: a network error must not send the request a second time (the SDK's own retry handles that).
 */
const preparingFetch: typeof fetch = async (input, init) => {
    if (!init || typeof init.body !== 'string') return fetch(input, init)
    let body: Json
    try {
        const parsed: unknown = JSON.parse(init.body)
        if (!isObj(parsed)) return fetch(input, init)
        body = parsed
    } catch {
        return fetch(input, init)
    }
    if (Array.isArray(body.tools)) {
        for (const t of body.tools) {
            if (isObj(t) && isObj(t.input_schema)) delete t.input_schema.$schema
        }
    }
    if (isDev) {
        const toolsJson = JSON.stringify(body.tools ?? [])
        const systemJson = JSON.stringify(body.system ?? '')
        const messages = Array.isArray(body.messages) ? body.messages : []
        console.info('[ai cache] request', {
            model: body.model,
            tools: `${fingerprint(toolsJson)}/${toolsJson.length}`,
            system: `${fingerprint(systemJson)}/${systemJson.length}`,
            messages: messages.length,
            thinking: JSON.stringify(body.thinking ?? null),
            effort: isObj(body.output_config) ? body.output_config.effort : undefined,
        })
    }
    return fetch(input, { ...init, body: JSON.stringify(body) })
}

let provider: ReturnType<typeof createAnthropic> | null = null

function getProvider() {
    if (!provider) {
        const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
        provider = createAnthropic({ apiKey, fetch: preparingFetch })
    }
    return provider
}

/** The language model for a task. Never pass a model id at a call site - name the task. */
export function getChatModel(task: AiTaskName): { model: LanguageModel; modelId: string } {
    const cfg = taskConfig(task)
    return { model: getProvider()(cfg.model), modelId: cfg.model }
}

/** Whether AI is configured at all (the page can show a plain line instead of failing on send). */
export function aiConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY?.trim()
}
