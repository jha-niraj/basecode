import 'server-only'
import { modelMessageSchema, type ModelMessage } from '@repo/ai'
import { db, and, eq, asc, desc, gte, lt, count, sql } from '@repo/db'
import { aiConversations, aiMessages, notes, session, user } from '@repo/db/schema'
import { asParts } from './parts'
import type { ChatViewMessage, ConversationRow, ConversationView, NeedsYouItem, NeedsYouList, UserPeekData } from './types'
import { storageHref } from '@repo/storage'
import { userPeekHref } from '@/lib/peeks/peek-routes'

/**
 * Server reads for the AI page. Every read filters by the signed-in person's id - a conversation id from the URL is
 * never trusted on its own. Called from page.tsx (server) and from the actions in actions/ai (which check the session).
 */

export async function listConversationsFor(userId: string): Promise<ConversationRow[]> {
    const rows = await db
        .select({ id: aiConversations.id, title: aiConversations.title, updatedAt: aiConversations.updatedAt })
        .from(aiConversations)
        .where(eq(aiConversations.userId, userId))
        .orderBy(desc(aiConversations.updatedAt))
        .limit(100)
    return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString() }))
}

type MessageRow = typeof aiMessages.$inferSelect

export async function conversationRows(userId: string, conversationId: string): Promise<{ title: string; rows: MessageRow[] } | null> {
    const [conv, rows] = await db.batch([
        db.select({ title: aiConversations.title }).from(aiConversations)
            .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId))).limit(1),
        db.select().from(aiMessages)
            .where(and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.userId, userId)))
            .orderBy(asc(aiMessages.createdAt)),
    ])
    const c = conv[0]
    return c ? { title: c.title, rows } : null
}

export function toView(rows: MessageRow[]): ChatViewMessage[] {
    return rows.map((r) => r.role === 'user'
        ? { id: r.id, role: 'user', text: r.display ?? r.content, parts: [] }
        : { id: r.id, role: 'assistant', text: '', parts: asParts(r.parts) })
}

export async function loadConversationView(userId: string, conversationId: string): Promise<ConversationView | null> {
    const found = await conversationRows(userId, conversationId)
    return found ? { id: conversationId, title: found.title, messages: toView(found.rows) } : null
}

const storedMessages = modelMessageSchema.array()
/** History kept to the most recent rows. Trimming moves the prefix (one cache rewrite), so it is generous. */
const MAX_HISTORY_ROWS = 80

/**
 * The model history, rebuilt from stored rows: user messages with their own context block after them, assistant turns
 * replayed from the provider-shaped messages stored with them (tool calls and results included, byte for byte).
 */
export function buildHistory(rows: MessageRow[]): ModelMessage[] {
    const out: ModelMessage[] = []
    for (const r of rows.slice(-MAX_HISTORY_ROWS)) {
        if (r.role === 'user') {
            out.push({ role: 'user', content: r.content })
            if (r.context) out.push({ role: 'system', content: r.context })
        } else {
            const parsed = storedMessages.safeParse(r.modelMessages)
            if (parsed.success && parsed.data.length) out.push(...parsed.data)
            else if (r.content) out.push({ role: 'assistant', content: r.content })
        }
    }
    // A mid-conversation system message must be followed by an assistant turn (or be last). Drop a context block whose
    // turn has no stored reply (a failed turn), and never start with one.
    while (out[0] && out[0].role !== 'user') out.shift()
    return out.filter((m, i) => m.role !== 'system' || i === out.length - 1 || out[i + 1]?.role === 'assistant')
}

// ─── Needs you (one free read, no model call) ─────────────────────────────────

/**
 * EXAMPLE sources a project replaces with what its people must act on. Each source has its own try/catch, so one
 * failure marks the list partial instead of hiding it.
 */
export async function needsYouFor(viewer: { id: string; role: string; emailVerified: boolean }): Promise<NeedsYouList> {
    const items: NeedsYouItem[] = []
    const failed: string[] = []

    if (!viewer.emailVerified) {
        items.push({ id: 'self-verify', group: 'now', title: 'Verify your email', detail: 'Open the link we sent you to finish signing up.', href: userPeekHref(viewer.id) })
    }

    if (viewer.role === 'ADMIN') {
        try {
            const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
            const rows = await db
                .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
                .from(user)
                .where(and(eq(user.emailVerified, false), lt(user.createdAt, dayAgo)))
                .orderBy(desc(user.createdAt))
                .limit(20)
            for (const r of rows) {
                items.push({
                    id: `unverified-${r.id}`,
                    group: 'today',
                    title: r.name,
                    detail: `${r.email} - signed up ${r.createdAt.toISOString().slice(0, 10)}, email not verified`,
                    href: userPeekHref(r.id),
                })
            }
        } catch (err) {
            console.error('[ai] needs-you: unverified users failed', err instanceof Error ? err.message : err)
            failed.push('people who never verified their email')
        }
    }
    return { items, failed }
}

// ─── Peek: one person ─────────────────────────────────────────────────────────

/** A person's quick look. Admins see anyone; everyone else only themselves (null = not found or not allowed). */
export async function userPeekFor(viewer: { id: string; role: string }, targetId: string): Promise<UserPeekData | null> {
    if (viewer.role !== 'ADMIN' && viewer.id !== targetId) return null
    const DAY = 24 * 60 * 60 * 1000
    const now = Date.now()
    const [found, signIns, noteCount] = await db.batch([
        db.select({ id: user.id, name: user.name, email: user.email, image: user.image, emailVerified: user.emailVerified, createdAt: user.createdAt })
            .from(user).where(eq(user.id, targetId)).limit(1),
        db.select({
            last7: sql<number>`count(*) filter (where ${session.createdAt} >= ${new Date(now - 7 * DAY)})`.mapWith(Number),
            last30: sql<number>`count(*) filter (where ${session.createdAt} >= ${new Date(now - 30 * DAY)})`.mapWith(Number),
        }).from(session).where(and(eq(session.userId, targetId), gte(session.createdAt, new Date(now - 30 * DAY)))),
        db.select({ n: count() }).from(notes).where(eq(notes.userId, targetId)),
    ])
    const u = found[0]
    if (!u) return null
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        image: storageHref(u.image ?? null),
        emailVerified: u.emailVerified,
        joinedAt: u.createdAt.toISOString(),
        signIns: { last7: signIns[0]?.last7 ?? 0, last30: signIns[0]?.last30 ?? 0 },
        notes: noteCount[0]?.n ?? 0,
    }
}
