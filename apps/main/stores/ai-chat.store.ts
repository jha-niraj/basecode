import { create } from 'zustand'
import type { CardState, ChatCard, ChatLink } from '@repo/ai/protocol'
import type { ChatViewMessage, ConversationView } from '@/lib/ai/types'

/**
 * The AI page's chat state. Client only. The transcript, the right column's card layer and History all read it, so
 * a card pressed in the column and a message typed in the composer go through the same `send` (use-chat.ts).
 * Form values live HERE, keyed by card id, so a form survives the column closing or the layer being stepped out of.
 */
export type ChatStatus = 'idle' | 'streaming'

interface AiChatState {
    conversationId: string | null
    title: string
    messages: ChatViewMessage[]
    status: ChatStatus
    /** One plain line under the transcript (a limit reached, a failed send). Never "Connection failed". */
    note: string | null
    /** A button under the note (out of credits -> "Top up" to billing). */
    noteAction: { label: string; href: string } | null
    loadingConversation: boolean
    formValues: Record<string, Record<string, string>>

    reset: () => void
    load: (view: ConversationView) => void
    setLoading: (on: boolean) => void
    setNote: (note: string | null, action?: { label: string; href: string } | null) => void
    setStatus: (status: ChatStatus) => void
    setConversation: (id: string, title: string) => void
    push: (...messages: ChatViewMessage[]) => void
    renameMessage: (from: string, to: string) => void
    removeMessage: (id: string) => void
    /** Append streamed text to an assistant message. */
    appendText: (messageId: string, text: string) => void
    /** Streamed thinking: kept as ONE `thought` part, first in the message. */
    appendThought: (messageId: string, text: string) => void
    thoughtEnd: (messageId: string, ms: number) => void
    toolCall: (messageId: string, id: string, name: string, label: string, at?: number) => void
    toolDone: (messageId: string, id: string, ok: boolean, at?: number) => void
    addCard: (messageId: string, card: ChatCard) => void
    addLink: (messageId: string, link: ChatLink) => void
    addNotice: (messageId: string, text: string) => void
    finish: (messageId: string) => void
    setCardState: (cardId: string, state: CardState, answer?: string) => void
    setFormValue: (cardId: string, field: string, value: string) => void
}

function mapMessage(messages: ChatViewMessage[], id: string, fn: (m: ChatViewMessage) => ChatViewMessage): ChatViewMessage[] {
    return messages.map((m) => (m.id === id ? fn(m) : m))
}

export const useAiChat = create<AiChatState>((set) => ({
    conversationId: null,
    title: '',
    messages: [],
    status: 'idle',
    note: null,
    noteAction: null,
    loadingConversation: false,
    formValues: {},

    reset: () => set({ conversationId: null, title: '', messages: [], status: 'idle', note: null, noteAction: null, loadingConversation: false }),
    load: (view) => set({ conversationId: view.id, title: view.title, messages: view.messages, status: 'idle', note: null, loadingConversation: false }),
    setLoading: (on) => set({ loadingConversation: on }),
    setNote: (note, action = null) => set({ note, noteAction: note ? action : null }),
    setStatus: (status) => set({ status }),
    setConversation: (id, title) => set({ conversationId: id, title }),
    push: (...messages) => set((s) => ({ messages: [...s.messages, ...messages] })),
    renameMessage: (from, to) => set((s) => ({ messages: mapMessage(s.messages, from, (m) => ({ ...m, id: to })) })),
    removeMessage: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
    appendText: (messageId, text) => set((s) => ({
        messages: mapMessage(s.messages, messageId, (m) => {
            const parts = [...m.parts]
            const last = parts[parts.length - 1]
            if (last?.type === 'text') parts[parts.length - 1] = { type: 'text', text: last.text + text }
            else parts.push({ type: 'text', text })
            return { ...m, parts }
        }),
    })),
    appendThought: (messageId, text) => set((s) => ({
        messages: mapMessage(s.messages, messageId, (m) => {
            const first = m.parts[0]
            const parts = first?.type === 'thought'
                ? [{ ...first, text: first.text + text }, ...m.parts.slice(1)]
                : [{ type: 'thought' as const, text, ms: 0 }, ...m.parts]
            return { ...m, parts, thinking: true }
        }),
    })),
    thoughtEnd: (messageId, ms) => set((s) => ({
        messages: mapMessage(s.messages, messageId, (m) => {
            const first = m.parts[0]
            if (first?.type !== 'thought') return { ...m, thinking: false }
            return { ...m, thinking: false, parts: [{ ...first, ms: (first.ms ?? 0) + ms }, ...m.parts.slice(1)] }
        }),
    })),
    toolCall: (messageId, id, name, label, at) => set((s) => ({
        messages: mapMessage(s.messages, messageId, (m) => ({
            ...m,
            parts: [...m.parts, { type: 'tool', id, name, label, ok: true, startedAt: at }],
            runningTools: [...(m.runningTools ?? []), id],
        })),
    })),
    toolDone: (messageId, id, ok, at) => set((s) => ({
        messages: mapMessage(s.messages, messageId, (m) => ({
            ...m,
            parts: m.parts.map((p) => (p.type === 'tool' && p.id === id ? { ...p, ok, endedAt: at } : p)),
            runningTools: (m.runningTools ?? []).filter((t) => t !== id),
        })),
    })),
    addCard: (messageId, card) => set((s) => ({
        messages: mapMessage(s.messages, messageId, (m) => ({ ...m, parts: [...m.parts, { type: 'card', card, state: 'open' }] })),
    })),
    addLink: (messageId, link) => set((s) => ({
        messages: mapMessage(s.messages, messageId, (m) => ({ ...m, parts: [...m.parts, { type: 'link', link }] })),
    })),
    addNotice: (messageId, text) => set((s) => ({
        messages: mapMessage(s.messages, messageId, (m) => ({ ...m, parts: [...m.parts, { type: 'notice', text }] })),
    })),
    finish: (messageId) => set((s) => ({
        messages: mapMessage(s.messages, messageId, (m) => ({ ...m, pending: false, runningTools: [], thinking: false })),
    })),
    setCardState: (cardId, state, answer) => set((s) => ({
        messages: s.messages.map((m) => (m.role !== 'assistant' ? m : {
            ...m,
            parts: m.parts.map((p) => (p.type === 'card' && p.card.id === cardId ? { ...p, state, answer } : p)),
        })),
    })),
    setFormValue: (cardId, field, value) => set((s) => ({
        formValues: { ...s.formValues, [cardId]: { ...s.formValues[cardId], [field]: value } },
    })),
}))
