import { z } from 'zod'
import { aiConfigured, aiErrorMessage, encodeFrame, runChatTurn, taskConfig, turnContextMessage, type ChatFrame, type MessagePart } from '@repo/ai'
import { checkDailyCap, creditsEnforced, hasCredits, priceCall, spendCredits } from '@repo/billing'
import { db, and, eq } from '@repo/db'
import { aiConversations, aiMessages } from '@repo/db/schema'
import { getSession } from '@/lib/session'
import { ROUTES } from '@/lib/navigation'
import '@/lib/ai/usage-sink'
import { AI_SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { turnContext } from '@/lib/ai/context'
import { buildHistory, conversationRows } from '@/lib/ai/conversations'
import { asParts } from '@/lib/ai/parts'
import { buildTools, toolOrder, CARD_TOOLS, TOOL_LABELS } from '@/lib/ai/tools'

/**
 * POST /api/ai/chat - one turn of the AI page, streamed as NDJSON frames (@repo/ai/protocol).
 *
 * Runs INLINE (the person waits for it, a few seconds): the user message is stored before the model runs, the reply
 * (parts + provider messages) and the usage row are written before the stream closes - nothing that the person is
 * told happened is left to `after()`.
 *
 * Status codes the page turns into a plain sentence: 401 signed out, 402 today's AI limit reached or out of credits
 * (CREDITS_ENFORCED=1; the body carries `href` + `actionLabel` for a top-up button), 404 the chat is gone (the page
 * starts a fresh one and resends once), 409 the card was already decided, 503 AI not configured.
 *
 * Credits (CREDITS_ENFORCED=1): a turn needs a positive balance; its metered cost is spent INLINE after the turn,
 * keyed on the assistant message id (a retry never charges twice). A turn that failed with no answer is not charged.
 */

const bodySchema = z.object({
    conversationId: z.string().min(1).max(100).nullish(),
    message: z.string().trim().min(1).max(8000),
    display: z.string().max(8000).optional(),
    answerTo: z.string().min(1).max(200).optional(),
    decision: z.enum(['answered', 'confirmed', 'cancelled', 'submitted']).optional(),
})

const json = (status: number, code: string, message: string) => Response.json({ code, message }, { status })

function titleFrom(text: string): string {
    const one = text.replace(/\s+/g, ' ').trim()
    return one.length > 60 ? `${one.slice(0, 57).trimEnd()}...` : one || 'New chat'
}

export async function POST(req: Request): Promise<Response> {
    const s = await getSession()
    if (!s) return json(401, 'auth', 'Your session ended. Sign in again.')
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return json(400, 'invalid', 'That message could not be read.')
    const body = parsed.data
    const me = s.user

    if (!aiConfigured()) return json(503, 'not_configured', aiErrorMessage('not_configured'))
    const cap = await checkDailyCap(db, me.id)
    if (!cap.ok) return json(402, 'cap', aiErrorMessage('cap'))
    if (!(await hasCredits(me.id))) {
        return Response.json(
            { code: 'credits', message: 'You are out of credits. Top up to keep using AI.', href: ROUTES.settingsBilling, actionLabel: 'Top up credits' },
            { status: 402 },
        )
    }

    // The conversation: an id from the client is only used if it is this person's.
    let conversationId = body.conversationId ?? null
    let title = 'New chat'
    let historyRows: Awaited<ReturnType<typeof conversationRows>> = null
    if (conversationId) {
        historyRows = await conversationRows(me.id, conversationId)
        if (!historyRows) return json(404, 'not_found', 'That chat could not be found.')
        title = historyRows.title
    }

    // A card answer closes its card exactly once: it must be open on the latest assistant message.
    if (body.answerTo && conversationId && historyRows) {
        const last = [...historyRows.rows].reverse().find((r) => r.role === 'assistant')
        const parts = last ? asParts(last.parts) : []
        const card = parts.find((p): p is Extract<MessagePart, { type: 'card' }> => p.type === 'card' && p.card.id === body.answerTo)
        if (!last || !card || card.state !== 'open') return json(409, 'conflict', 'That was already decided.')
        card.state = body.decision ?? 'answered'
        card.answer = (body.display ?? body.message).slice(0, 500)
        await db.update(aiMessages).set({ parts }).where(and(eq(aiMessages.id, last.id), eq(aiMessages.userId, me.id)))
    }

    const context = turnContext({ name: me.name, role: me.role })
    const userMessageId = crypto.randomUUID()
    const assistantMessageId = crypto.randomUUID()
    const userRow = {
        id: userMessageId,
        userId: me.id,
        role: 'user' as const,
        content: body.message,
        display: body.display && body.display !== body.message ? body.display : null,
        context,
    }
    if (!conversationId) {
        conversationId = crypto.randomUUID()
        title = titleFrom(body.display ?? body.message)
        await db.batch([
            db.insert(aiConversations).values({ id: conversationId, userId: me.id, title }),
            db.insert(aiMessages).values({ ...userRow, conversationId }),
        ])
    } else {
        await db.insert(aiMessages).values({ ...userRow, conversationId })
    }

    const ctxMessage = turnContextMessage(context)
    const messages = [
        ...buildHistory(historyRows?.rows ?? []),
        { role: 'user' as const, content: body.message },
        ...(ctxMessage ? [ctxMessage] : []),
    ]
    const tools = buildTools({ userId: me.id, role: me.role })
    const convId = conversationId
    const convTitle = title

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const enc = new TextEncoder()
            let open = true
            const emit = (frame: ChatFrame) => {
                if (!open) return
                try { controller.enqueue(enc.encode(encodeFrame(frame))) } catch { open = false }
            }
            emit({ t: 'meta', conversationId: convId, userMessageId, assistantMessageId, title: convTitle })

            const result = await runChatTurn({
                task: 'chat',
                instructions: AI_SYSTEM_PROMPT,
                tools,
                toolOrder: toolOrder(),
                messages,
                stopOnTools: CARD_TOOLS,
                toolLabels: TOOL_LABELS,
                maxSteps: 6,
                abortSignal: req.signal,
                usage: { userId: me.id, feature: 'ai_page_chat', conversationId: convId },
            }, emit)

            // Spend the turn's cost (inline, never after(): it is money). The meter already logged the usage row.
            if (creditsEnforced() && result.requests.length && !(result.error && !result.text)) {
                try {
                    const cost = priceCall(taskConfig('chat').model, result.requests)
                    await spendCredits(me.id, cost.microUsd, assistantMessageId)
                } catch (err) {
                    console.error('[ai] could not spend credits for the turn', err instanceof Error ? err.message : err)
                }
            }

            // Store whatever the person saw (a Stop keeps its partial text). A turn with nothing is not stored, so the
            // next turn does not replay an empty assistant message.
            try {
                if (result.parts.length || result.responseMessages.length) {
                    await db.batch([
                        db.insert(aiMessages).values({
                            id: assistantMessageId,
                            conversationId: convId,
                            userId: me.id,
                            role: 'assistant',
                            content: result.text,
                            parts: result.parts,
                            modelMessages: result.responseMessages.length ? result.responseMessages : null,
                        }),
                        db.update(aiConversations).set({ updatedAt: new Date() })
                            .where(and(eq(aiConversations.id, convId), eq(aiConversations.userId, me.id))),
                    ])
                } else {
                    await db.update(aiConversations).set({ updatedAt: new Date() })
                        .where(and(eq(aiConversations.id, convId), eq(aiConversations.userId, me.id)))
                }
            } catch (err) {
                console.error('[ai] could not store the reply', err instanceof Error ? err.message : err)
                emit({ t: 'notice', text: 'This reply could not be saved - it will not be in the chat after a refresh.' })
            }
            emit({ t: 'done' })
            if (open) { try { controller.close() } catch { /* the client left */ } }
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-Accel-Buffering': 'no',
        },
    })
}
