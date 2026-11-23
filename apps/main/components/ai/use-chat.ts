'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { readFrameStream, type CardReply, type ChatFrame } from '@repo/ai/protocol'
import { getConversation } from '@/actions/ai/ai.action'
import { useAiChat } from '@/stores/ai-chat.store'
import { AI_HISTORY_KEY } from './query-keys'

export interface SendInput {
    /** What the model reads. */
    content: string
    /** What the bubble shows, when different. */
    display?: string
    reply?: Pick<CardReply, 'answerTo' | 'decision'>
}

/** Write the conversation into the URL without a navigation (router.replace would re-render the route under the chat). */
function setUrl(conversationId: string | null) {
    const path = conversationId ? `/ai/${conversationId}` : '/ai'
    if (window.location.pathname === path) return
    const url = new URL(window.location.href)
    url.pathname = path
    window.history.replaceState(window.history.state, '', url.toString())
}

/**
 * THE one send path. Typed messages, Create cards, Ask rows and every card press go through `send`, so the server's
 * guards run on all of them. Token frames are coalesced to one store update per animation frame.
 */
export function useChat() {
    const queryClient = useQueryClient()
    const abortRef = useRef<AbortController | null>(null)
    const pending = useRef<{ messageId: string; text: string } | null>(null)
    const raf = useRef<number | null>(null)

    const flush = useCallback(() => {
        raf.current = null
        const p = pending.current
        if (p && p.text) {
            useAiChat.getState().appendText(p.messageId, p.text)
            p.text = ''
        }
    }, [])

    useEffect(() => () => {
        if (raf.current !== null) cancelAnimationFrame(raf.current)
        abortRef.current?.abort()
    }, [])

    const openConversation = useCallback(async (id: string) => {
        const st = useAiChat.getState()
        if (st.status === 'streaming') abortRef.current?.abort()
        st.setLoading(true)
        const res = await getConversation(id)
        if (res.success) {
            useAiChat.getState().load(res.data)
            setUrl(res.data.id)
        } else {
            useAiChat.getState().reset()
            useAiChat.getState().setNote(res.error ?? 'That chat could not be opened.')
            setUrl(null)
        }
    }, [])

    const newChat = useCallback(() => {
        abortRef.current?.abort()
        useAiChat.getState().reset()
        setUrl(null)
    }, [])

    const stop = useCallback(() => {
        abortRef.current?.abort()
    }, [])

    // Annotated: `send` calls itself once (a gone chat is retried fresh), so its type cannot be inferred.
    const send: (input: SendInput, retried?: boolean) => Promise<boolean> = useCallback(async (input: SendInput, retried = false): Promise<boolean> => {
        const store = useAiChat.getState()
        // Guard here, not by disabling the textarea: focus must stay in the composer while a reply streams.
        if (store.status === 'streaming' || !input.content.trim()) return false
        const tempUser = `local-u-${crypto.randomUUID()}`
        const tempAssistant = `local-a-${crypto.randomUUID()}`
        store.setNote(null)
        store.setStatus('streaming')
        if (input.reply) store.setCardState(input.reply.answerTo, input.reply.decision, input.display)
        store.push(
            { id: tempUser, role: 'user', text: input.display ?? input.content, parts: [] },
            { id: tempAssistant, role: 'assistant', text: '', parts: [], pending: true },
        )
        let assistantId = tempAssistant
        const controller = new AbortController()
        abortRef.current = controller

        const onFrame = (frame: ChatFrame) => {
            const s = useAiChat.getState()
            if (frame.t === 'text') {
                if (!pending.current || pending.current.messageId !== assistantId) pending.current = { messageId: assistantId, text: '' }
                pending.current.text += frame.d
                if (raf.current === null) raf.current = requestAnimationFrame(flush)
                return
            }
            flush()
            switch (frame.t) {
                case 'meta':
                    s.renameMessage(tempUser, frame.userMessageId)
                    s.renameMessage(tempAssistant, frame.assistantMessageId)
                    assistantId = frame.assistantMessageId
                    if (s.conversationId !== frame.conversationId) {
                        s.setConversation(frame.conversationId, frame.title)
                        setUrl(frame.conversationId)
                    }
                    break
                case 'reasoning': s.appendThought(assistantId, frame.d); break
                case 'reasoning-end': s.thoughtEnd(assistantId, frame.ms); break
                case 'tool':
                    if (frame.state === 'call') s.toolCall(assistantId, frame.id, frame.name, frame.label, frame.at)
                    else if (s.messages.find((m) => m.id === assistantId)?.parts.some((p) => p.type === 'tool' && p.id === frame.id)) s.toolDone(assistantId, frame.id, frame.state === 'done', frame.at)
                    else { s.toolCall(assistantId, frame.id, frame.name, frame.label, frame.at); s.toolDone(assistantId, frame.id, frame.state === 'done', frame.at) }
                    break
                case 'card': s.addCard(assistantId, frame.card); break
                case 'link': s.addLink(assistantId, frame.link); break
                case 'notice': s.addNotice(assistantId, frame.text); break
                case 'error': s.setNote(frame.message); break
                case 'done': break
            }
        }

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversationId: store.conversationId,
                    message: input.content,
                    display: input.display,
                    answerTo: input.reply?.answerTo,
                    decision: input.reply?.decision,
                }),
                signal: controller.signal,
            })
            if (!res.ok || !res.body) {
                const err: unknown = await res.json().catch(() => null)
                const message = typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' ? err.message : 'That message could not be sent. Try again.'
                const s = useAiChat.getState()
                s.removeMessage(tempUser)
                s.removeMessage(tempAssistant)
                s.setStatus('idle')
                if (res.status === 401) { window.location.assign('/signin?stale=1'); return false }
                if (res.status === 404 && !retried) {
                    // The chat is gone (deleted, or another account on this browser): start fresh and send once more.
                    s.reset()
                    setUrl(null)
                    return send({ content: input.display ?? input.content, display: input.display }, true)
                }
                if (res.status === 409) {
                    s.setNote('That was already decided.')
                    const id = s.conversationId
                    if (id) void openConversation(id)
                    return false
                }
                // Out of credits / daily cap: the sentence plus a button to where it is fixed - never "Connection failed".
                const action = res.status === 402 && typeof err === 'object' && err !== null && 'href' in err && typeof err.href === 'string' && err.href.startsWith('/')
                    ? { href: err.href, label: 'actionLabel' in err && typeof err.actionLabel === 'string' ? err.actionLabel : 'Top up' }
                    : null
                s.setNote(message, action)
                return false
            }
            await readFrameStream(res.body, onFrame)
            return true
        } catch {
            if (!controller.signal.aborted) useAiChat.getState().setNote('Could not reach the server. Check the connection and try again.')
            return false
        } finally {
            flush()
            const s = useAiChat.getState()
            const msg = s.messages.find((m) => m.id === assistantId)
            if (msg && !msg.parts.length && !controller.signal.aborted && !s.note) s.removeMessage(assistantId)
            s.finish(assistantId)
            s.setStatus('idle')
            if (abortRef.current === controller) abortRef.current = null
            void queryClient.invalidateQueries({ queryKey: AI_HISTORY_KEY })
        }
    }, [flush, openConversation, queryClient])

    return { send, stop, newChat, openConversation }
}
