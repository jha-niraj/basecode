/**
 * Model registry and prices - the ONE place rates live, so every surface computes the same number.
 *
 * USD per 1,000,000 tokens, Anthropic first-party rates. They go stale: re-check the live pricing page when a model is
 * added or a repricing lands. Cache reads and writes are SUBSETS of input tokens (the meter never adds them on top).
 *
 * Checked 2026-11-23:
 * - Claude Haiku 5.5: input 0.10, cache read 0.01 (0.1x), 5-minute write 0.125 (1.25x), 1-hour write 0.20 (2x),
 *   output 0.50. A prompt above 100K tokens is priced on the long-context card: 0.50 / 2.50, same multipliers.
 * - Claude Sonnet 5.5: input 2.00, cache read 0.10 (cheaper than the usual 0.1x - Anthropic's published rate; an earlier
 *   registry said 0.20), 5-minute write 2.50, 1-hour write 4.00, output 10.00.
 */

export interface Rates {
    input: number
    output: number
    cacheRead: number
    cacheWrite5m: number
    cacheWrite1h: number
}

export interface ModelInfo extends Rates {
    id: string
    label: string
    /** A second rate card for a request whose PROMPT (all input tokens) is above `above`. */
    longContext?: Rates & { above: number }
}

export const MODELS = {
    'claude-haiku-5-5': {
        id: 'claude-haiku-5-5',
        label: 'Claude Haiku 5.5',
        input: 0.1,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite5m: 0.125,
        cacheWrite1h: 0.2,
        longContext: { above: 100_000, input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite5m: 0.625, cacheWrite1h: 1 },
    },
    'claude-sonnet-5-5': {
        id: 'claude-sonnet-5-5',
        label: 'Claude Sonnet 5.5',
        input: 2,
        output: 10,
        cacheRead: 0.1,
        cacheWrite5m: 2.5,
        cacheWrite1h: 4,
    },
} as const satisfies Record<string, ModelInfo>

export type ModelId = keyof typeof MODELS

export function getModel(id: string): ModelInfo | undefined {
    return (MODELS as Record<string, ModelInfo>)[id]
}
