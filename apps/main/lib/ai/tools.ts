import 'server-only'
import { z } from 'zod'
import { tool } from '@repo/ai'
import { db, eq, desc, or, ilike, sql, count, and, isNull } from '@repo/db'
import { user, session, notes, aiConversations } from '@repo/db/schema'
import { userPeekHref } from '@/lib/peeks/peek-routes'

/**
 * The AI page's tools - EXAMPLES a project replaces with its own. They show each kind:
 *   a read with real numbers (getAppStats), a lookup that links a peek (findUser), the three cards (askUser,
 *   confirmAction, draftNote), a guarded write (saveNote), and an optional outside service (webSearch).
 *
 * Caching rules for tools (they sit at the very start of the cached prefix):
 * - descriptions and schemas are FIXED text; who is asking is in the closure, never in a description;
 * - the list and its order are the same on every request (`toolOrder`); webSearch is sent only when EXA_API_KEY is
 *   set, which is fixed per deployment, so the prefix is still stable.
 * Every tool re-checks what the person may see: a tool is a new door to the same data.
 */

export interface ToolContext {
    userId: string
    role: string
}

const DAY = 24 * 60 * 60 * 1000

function windows(now = new Date()) {
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    return { today, last7: new Date(now.getTime() - 7 * DAY), last30: new Date(now.getTime() - 30 * DAY), month }
}

/** Explicit buckets, so a bare total is never quoted as "today's" figure (AGENTS.md section 9). */
function bucketsSql(column: typeof user.createdAt | typeof session.createdAt, w: ReturnType<typeof windows>) {
    return {
        today: sql<number>`count(*) filter (where ${column} >= ${w.today})`.mapWith(Number),
        last7Days: sql<number>`count(*) filter (where ${column} >= ${w.last7})`.mapWith(Number),
        last30Days: sql<number>`count(*) filter (where ${column} >= ${w.last30})`.mapWith(Number),
        thisMonth: sql<number>`count(*) filter (where ${column} >= ${w.month})`.mapWith(Number),
        allTime: sql<number>`count(*)`.mapWith(Number),
    }
}

/** Plain text a tool may store: trimmed, capped. */
const clip = (s: string, max: number) => s.trim().slice(0, max)

export function buildTools(ctx: ToolContext) {
    const isAdmin = ctx.role === 'ADMIN'
    let writesThisTurn = 0

    const tools = {
        getAppStats: tool({
            description: 'Headline numbers with explicit time windows (today, last 7 days, last 30 days, this month, all time). For an admin: people who signed up and sign-ins across the whole app. For anyone else: their own sign-ins, notes and chats.',
            inputSchema: z.object({}),
            execute: async () => {
                const w = windows()
                if (isAdmin) {
                    const [signups, signIns] = await Promise.all([
                        db.select(bucketsSql(user.createdAt, w)).from(user),
                        db.select(bucketsSql(session.createdAt, w)).from(session),
                    ])
                    return { scope: 'whole app', windowsAreUtc: true, peopleSignedUp: signups[0], signIns: signIns[0] }
                }
                const [signIns, noteCount, chatCount] = await Promise.all([
                    db.select(bucketsSql(session.createdAt, w)).from(session).where(eq(session.userId, ctx.userId)),
                    db.select({ n: count() }).from(notes).where(eq(notes.userId, ctx.userId)),
                    db.select({ n: count() }).from(aiConversations).where(eq(aiConversations.userId, ctx.userId)),
                ])
                return {
                    scope: 'only this person (not an admin)',
                    windowsAreUtc: true,
                    signIns: signIns[0],
                    notesAllTime: noteCount[0]?.n ?? 0,
                    chatsAllTime: chatCount[0]?.n ?? 0,
                }
            },
        }),

        findUser: tool({
            description: 'Find people by part of their name or email (admins only). Returns up to 5 with a quick-look link each.',
            inputSchema: z.object({ query: z.string().min(1).max(100).describe('Part of a name or an email address') }),
            execute: async ({ query }) => {
                if (!isAdmin) {
                    return { allowed: false, reason: 'Only admins can look other people up.', _links: [{ label: 'Your own details', href: userPeekHref(ctx.userId) }] }
                }
                const q = `%${query.trim()}%`
                const rows = await db
                    .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
                    .from(user)
                    .where(or(ilike(user.name, q), ilike(user.email, q)))
                    .orderBy(desc(user.createdAt))
                    .limit(5)
                return {
                    count: rows.length,
                    people: rows.map((r) => ({ name: r.name, email: r.email, joined: r.createdAt.toISOString().slice(0, 10) })),
                    _links: rows.map((r) => ({ label: r.name, href: userPeekHref(r.id) })),
                }
            },
        }),

        askUser: tool({
            description: 'Show the person a card of up to 5 short questions, answered one at a time on the right. Use when you need details before you can act. Then stop and wait for the answers.',
            inputSchema: z.object({
                title: z.string().max(80).describe('What the questions are for, e.g. "A few details for the note"'),
                questions: z.array(z.object({
                    prompt: z.string().max(200),
                    kind: z.enum(['choice', 'text']),
                    options: z.array(z.string().max(60)).max(6).optional().describe('For kind=choice'),
                    multi: z.boolean().optional().describe('For kind=choice: more than one may be picked'),
                })).min(1).max(5),
            }),
            execute: async ({ title, questions }) => ({
                shown: true,
                _card: { kind: 'question', title, questions: questions.map((q, i) => ({ id: `q${i + 1}`, ...q })) },
            }),
        }),

        confirmAction: tool({
            description: 'Show a confirmation card before a write the person asked for in plain words. Name exactly what will happen. Then stop and wait.',
            inputSchema: z.object({
                title: z.string().max(100).describe('e.g. Save the note "Launch checklist"'),
                summary: z.string().max(200).optional(),
                items: z.array(z.string().max(120)).max(5).optional(),
                confirmLabel: z.string().max(30).describe('The button, e.g. "Save note"'),
            }),
            execute: async (input) => ({ shown: true, _card: { kind: 'confirm', ...input } }),
        }),

        draftNote: tool({
            description: 'Open the note form on the right, pre-filled with your best draft, for the person to edit and save. Then stop and wait.',
            inputSchema: z.object({ title: z.string().max(120), body: z.string().max(4000) }),
            execute: async ({ title, body }) => ({
                shown: true,
                _card: {
                    kind: 'form',
                    title: 'New note',
                    submitLabel: 'Save note',
                    fields: [
                        { name: 'title', label: 'Title', kind: 'text', value: title, maxLength: 120 },
                        { name: 'body', label: 'Note', kind: 'textarea', value: body, maxLength: 4000 },
                    ],
                },
            }),
        }),

        listNotes: tool({
            description: 'The person\'s own most recent notes that are not archived (title, first line, date).',
            inputSchema: z.object({ limit: z.number().int().min(1).max(20).optional() }),
            execute: async ({ limit }) => {
                const rows = await db
                    .select({ title: notes.title, body: notes.body, createdAt: notes.createdAt })
                    .from(notes)
                    .where(and(eq(notes.userId, ctx.userId), isNull(notes.archivedAt)))
                    .orderBy(desc(notes.updatedAt))
                    .limit(limit ?? 10)
                return { count: rows.length, notes: rows.map((r) => ({ title: r.title, firstLine: r.body.split('\n')[0]?.slice(0, 120) ?? '', date: r.createdAt.toISOString().slice(0, 10) })) }
            },
        }),

        saveNote: tool({
            description: 'Save a note for the person. Needs confirmed=true, which only comes from a confirmed card or a submitted note form.',
            inputSchema: z.object({ title: z.string().min(1).max(120), body: z.string().max(4000), confirmed: z.boolean() }),
            execute: async ({ title, body, confirmed }) => {
                // The guard lives HERE, not in the prompt: no confirmation, no write.
                if (!confirmed) return { saved: false, reason: 'Not confirmed. Show a confirmAction card (or the note form) first.' }
                if (writesThisTurn >= 5) return { saved: false, reason: 'At most five writes per message. Say where the rest is done.' }
                writesThisTurn += 1
                const [row] = await db
                    .insert(notes)
                    .values({ userId: ctx.userId, title: clip(title, 120), body: clip(body, 4000) })
                    .returning({ id: notes.id, title: notes.title })
                return { saved: true, title: row?.title ?? title }
            },
        }),

        // Always defined (so the tool set has one type); sent only when EXA_API_KEY is set - see `toolOrder`.
        webSearch: tool({
            description: 'Search the web for current facts. Returns a few results with title, url and a short extract.',
            inputSchema: z.object({ query: z.string().min(2).max(200) }),
            execute: async ({ query }) => {
                try {
                    const { exaSearch } = await import('@repo/webdata')
                    const results = await exaSearch(query)
                    return { results }
                } catch (err) {
                    console.error('[ai] webSearch failed', err instanceof Error ? err.message : err)
                    return { _outage: 'Web search is not answering right now.' }
                }
            },
        }),
    }
    return tools
}

export type AppTools = ReturnType<typeof buildTools>
export type AppToolName = keyof AppTools & string

/** Web search is on when this deployment has an Exa key (fixed per deployment, so the tools prefix stays stable). */
export function webSearchEnabled(): boolean {
    return !!process.env.EXA_API_KEY?.trim()
}

/** The FIXED order tools are sent in (also the active list). webSearch only when it is enabled. */
export function toolOrder(): AppToolName[] {
    const order: AppToolName[] = ['getAppStats', 'findUser', 'listNotes', 'saveNote', 'askUser', 'confirmAction', 'draftNote']
    return webSearchEnabled() ? [...order, 'webSearch'] : order
}

/** A call to one of these ends the turn: a card is waiting on the person. */
export const CARD_TOOLS = ['askUser', 'confirmAction', 'draftNote'] as const

/** Activity lines under a reply. Card tools have none (the card is the line). */
export const TOOL_LABELS: Record<string, string> = {
    getAppStats: 'Looked up the numbers',
    findUser: 'Looked people up',
    listNotes: 'Read your notes',
    saveNote: 'Saved the note',
    webSearch: 'Searched the web',
}
