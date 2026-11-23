/**
 * The chat wire protocol - newline-delimited JSON frames, one per line - and the stored message parts.
 *
 * CLIENT-SAFE: no imports. The browser imports this file as `@repo/ai/protocol`; never import `@repo/ai` (the server
 * entry, which pulls in the provider) from client code.
 *
 * Cards (a question, a confirmation, a form) come from TOOLS as structured data, never parsed out of the model's text.
 * Pressing a card button SENDS A MESSAGE (`answerTo` = the card id); the write happens server-side through a guarded
 * tool, so the guards and the audit trail stay intact.
 */

// ─── Cards ────────────────────────────────────────────────────────────────────

export interface ChatQuestion {
    id: string
    prompt: string
    /** `choice`: pick from options (one, or several with `multi`); `text`: a short typed answer. */
    kind: 'choice' | 'text'
    options?: string[]
    multi?: boolean
}

export interface ChatQuestionCard {
    kind: 'question'
    id: string
    title: string
    questions: ChatQuestion[]
}

export interface ChatConfirmCard {
    kind: 'confirm'
    id: string
    /** "Save the note "Launch checklist"" */
    title: string
    /** One line on what happens. */
    summary?: string
    items?: string[]
    confirmLabel: string
}

export interface ChatFormField {
    name: string
    label: string
    kind: 'text' | 'textarea'
    value: string
    maxLength?: number
}

export interface ChatFormCard {
    kind: 'form'
    id: string
    title: string
    fields: ChatFormField[]
    submitLabel: string
}

export type ChatCard = ChatQuestionCard | ChatConfirmCard | ChatFormCard

export type CardState = 'open' | 'answered' | 'confirmed' | 'cancelled' | 'submitted'

/** A structured link from a tool. `/peek/<kind>/<id>` opens a quick look beside the chat instead of navigating. */
export interface ChatLink {
    label: string
    href: string
}

// ─── Stored parts (what a refresh re-renders) ─────────────────────────────────

export type MessagePart =
    | { type: 'text'; text: string }
    /** The model's own (summarised) thinking on this turn, and how long it took. One per message, first. */
    | { type: 'thought'; text: string; ms?: number }
    | { type: 'tool'; id: string; name: string; label: string; ok: boolean; startedAt?: number; endedAt?: number }
    | { type: 'card'; card: ChatCard; state: CardState; answer?: string }
    | { type: 'link'; link: ChatLink }
    | { type: 'notice'; text: string }

// ─── Frames ───────────────────────────────────────────────────────────────────

export type ChatErrorCode = 'cap' | 'overloaded' | 'rate_limit' | 'quota' | 'auth' | 'invalid' | 'not_configured' | 'unknown'

export type ChatFrame =
    | { t: 'meta'; conversationId: string; userMessageId: string; assistantMessageId: string; title: string }
    | { t: 'text'; d: string }
    /** Thinking, streamed; `reasoning-end` closes a thinking block with its duration. */
    | { t: 'reasoning'; d: string }
    | { t: 'reasoning-end'; ms: number }
    | { t: 'tool'; id: string; name: string; label: string; state: 'call' | 'done' | 'error'; at: number }
    | { t: 'card'; card: ChatCard }
    | { t: 'link'; link: ChatLink }
    | { t: 'notice'; text: string }
    | { t: 'error'; code: ChatErrorCode; message: string }
    | { t: 'done' }

export function encodeFrame(frame: ChatFrame): string {
    return `${JSON.stringify(frame)}\n`
}

const FRAME_TYPES = new Set(['meta', 'text', 'reasoning', 'reasoning-end', 'tool', 'card', 'link', 'notice', 'error', 'done'])

function isFrame(v: unknown): v is ChatFrame {
    return typeof v === 'object' && v !== null && 't' in v && typeof v.t === 'string' && FRAME_TYPES.has(v.t)
}

/** Read an NDJSON frame stream, calling `onFrame` for each complete frame. Resolves when the stream ends. */
export async function readFrameStream(body: ReadableStream<Uint8Array>, onFrame: (frame: ChatFrame) => void): Promise<void> {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const flush = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed) return
        try {
            const parsed: unknown = JSON.parse(trimmed)
            if (isFrame(parsed)) onFrame(parsed)
        } catch { /* a broken line is skipped, never fatal */ }
    }
    for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl = buffer.indexOf('\n')
        while (nl !== -1) {
            flush(buffer.slice(0, nl))
            buffer = buffer.slice(nl + 1)
            nl = buffer.indexOf('\n')
        }
    }
    flush(buffer + decoder.decode())
}

/** The model-facing text and the bubble text for a card answer - two strings, so the model is told exactly what to do
 *  (without it the model often shows a second identical card) while the person reads what they would have said. */
export interface CardReply {
    answerTo: string
    decision: Exclude<CardState, 'open'>
    content: string
    display: string
}
