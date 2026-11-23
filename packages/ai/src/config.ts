import type { ModelId } from './models'

/**
 * THE task -> model map. A call site names a TASK, never a model id.
 *
 * - Everyday work (chat, summaries, classification) runs on Claude Haiku 5.5 - about 20x cheaper than Sonnet per token.
 * - Claude Sonnet 5.5 only for named heavy tasks. A task moves between them only after looking at its output on real
 *   inputs (the cost handoff: a task moved back when quality dropped).
 * - Thinking is adaptive on every task and the SAME on every turn of a conversation (`thinkingFor` in anthropic.ts):
 *   switching thinking or effort between turns invalidates the whole cached prefix.
 * - Effort is set explicitly per task (Haiku 5.5 defaults to `medium`; `low` is right for chat-like work).
 * - `maxOutputTokens` is a safety ceiling, not a brevity tool - answer length is steered in the prompt.
 *
 * EXAMPLE TASKS - a project replaces these with its own.
 */
export interface AiTaskConfig {
    model: ModelId
    effort: 'low' | 'medium' | 'high'
    maxOutputTokens: number
    /** Shown on a usage screen. */
    label: string
}

export const AI_TASKS = {
    chat: { model: 'claude-haiku-5-5', effort: 'low', maxOutputTokens: 8000, label: 'The AI page chat' },
    summary: { model: 'claude-haiku-5-5', effort: 'low', maxOutputTokens: 2000, label: 'Short summaries' },
    classify: { model: 'claude-haiku-5-5', effort: 'low', maxOutputTokens: 500, label: 'Sorting text into a label' },
    // Example of a heavy task on the big model: turning a long source document into structured data verbatim.
    heavy_extract: { model: 'claude-sonnet-5-5', effort: 'medium', maxOutputTokens: 16000, label: 'Long document to structured data' },
} as const satisfies Record<string, AiTaskConfig>

export type AiTaskName = keyof typeof AI_TASKS

export function taskConfig(task: AiTaskName): AiTaskConfig {
    return AI_TASKS[task]
}
