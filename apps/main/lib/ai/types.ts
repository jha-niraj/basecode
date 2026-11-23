// Types shared by the AI page's server code and its client components. Pure - no imports that pull in server code.
import type { CardState, MessagePart } from '@repo/ai/protocol'

export interface ChatViewMessage {
    id: string
    role: 'user' | 'assistant'
    /** User rows: the bubble text. Assistant rows: unused (the text lives in `parts`). */
    text: string
    parts: MessagePart[]
    /** Still streaming. */
    pending?: boolean
    /** Tool calls running right now (shown live in the steps). */
    runningTools?: string[]
    /** A thinking block is streaming right now. */
    thinking?: boolean
}

export interface ConversationView {
    id: string
    title: string
    messages: ChatViewMessage[]
}

export interface ConversationRow {
    id: string
    title: string
    /** ISO instant. */
    updatedAt: string
}

export type NeedsYouGroup = 'now' | 'today' | 'later'

export interface NeedsYouItem {
    id: string
    group: NeedsYouGroup
    title: string
    detail: string
    /** `/peek/...` opens a quick look; anything else is a page. */
    href?: string
}

export interface NeedsYouList {
    items: NeedsYouItem[]
    /** Sources that could not be read - shown as a line with Try again, never as "You're clear". */
    failed: string[]
}

export interface UserPeekData {
    id: string
    name: string
    email: string
    image: string | null
    emailVerified: boolean
    /** ISO instant. */
    joinedAt: string
    signIns: { last7: number; last30: number }
    notes: number
}

export interface ChatRequestBody {
    conversationId?: string | null
    /** What the model reads. */
    message: string
    /** What the bubble shows, when it differs. */
    display?: string
    /** A card answer: the card id and what was decided. */
    answerTo?: string
    decision?: Exclude<CardState, 'open'>
}
