import 'server-only'

import { and, count, db, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from '@repo/db'
import { notes } from '@repo/db/schema'
import { NOTES_PAGE_SIZE } from '@/schemas/notes'
import type { NoteDetail, NoteListPage, NoteListParams, NoteRow, NoteStats, NoteWeekBucket } from '@/types/notes'

/**
 * Notes - the reads, shared by the Server Actions (`actions/notes.action.ts`) and the PDF document
 * (`/api/documents/notes.pdf`), so the list on screen and the file always filter the same way.
 *
 * Why a `server-only` module and not the 'use server' file: every export of a 'use server' file becomes a public
 * endpoint. These helpers take a `userId` argument - as endpoints anyone could pass someone else's. The actions read the
 * id from the session and call in here.
 */

/** Characters of the body the list carries. The sheet reads the whole note by id. */
const PREVIEW_CHARS = 200

const rowColumns = {
    id: notes.id,
    title: notes.title,
    preview: sql<string>`left(${notes.body}, ${PREVIEW_CHARS})`,
    tags: notes.tags,
    pinned: notes.pinned,
    archivedAt: notes.archivedAt,
    createdAt: notes.createdAt,
    updatedAt: notes.updatedAt,
}

type RowRecord = { id: string; title: string; preview: string; tags: string[]; pinned: boolean; archivedAt: Date | null; createdAt: Date; updatedAt: Date }

function toRow(r: RowRecord): NoteRow {
    return {
        id: r.id,
        title: r.title,
        preview: r.preview,
        tags: r.tags,
        pinned: r.pinned,
        archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
    }
}

/** `%` and `_` typed into the search box are text, not wildcards. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

/** The WHERE for a list view. It ALWAYS starts with the owner - there is no code path that lists without it. */
export function notesWhere(userId: string, p: Omit<NoteListParams, 'page'>): SQL | undefined {
    const conds: SQL[] = [
        eq(notes.userId, userId),
        p.tab === 'archived' ? isNotNull(notes.archivedAt) : isNull(notes.archivedAt),
    ]
    if (p.q) {
        const like = `%${escapeLike(p.q)}%`
        const match = or(ilike(notes.title, like), ilike(notes.body, like))
        if (match) conds.push(match)
    }
    if (p.tags.length > 0) {
        // `&&` = the arrays overlap: "has any of these tags", the one operator the tag chip offers.
        conds.push(sql`${notes.tags} && ARRAY[${sql.join(p.tags.map((t) => sql`${t}`), sql`, `)}]::text[]`)
    }
    if (p.pinned) conds.push(eq(notes.pinned, p.pinned === 'yes'))
    return and(...conds)
}

/** Pinned first, then the most recently edited; `id` last so two equal timestamps never swap between pages. */
const listOrder = [desc(notes.pinned), desc(notes.updatedAt), desc(notes.id)]

/** One page plus the total - two statements, ONE round trip (`db.batch`; neon-http has no transactions). */
export async function readNotePage(userId: string, p: NoteListParams): Promise<NoteListPage> {
    const where = notesWhere(userId, p)
    const pageSize = NOTES_PAGE_SIZE
    const [rows, totals] = await db.batch([
        db.select(rowColumns).from(notes).where(where).orderBy(...listOrder).limit(pageSize).offset((p.page - 1) * pageSize),
        db.select({ n: count() }).from(notes).where(where),
    ])
    const total = totals[0]?.n ?? 0
    return { items: rows.map(toRow), total, page: p.page, pages: Math.max(1, Math.ceil(total / pageSize)), pageSize }
}

/** Every note in a view, for the PDF. Capped; the caller says so in the file when the cap is hit. */
export async function readAllNotes(userId: string, p: Omit<NoteListParams, 'page'>, cap: number): Promise<NoteDetail[]> {
    const rows = await db
        .select({ ...rowColumns, body: notes.body })
        .from(notes)
        .where(notesWhere(userId, p))
        .orderBy(...listOrder)
        .limit(cap)
    return rows.map((r) => ({ ...toRow(r), body: r.body }))
}

export async function readNote(userId: string, id: string): Promise<NoteDetail | null> {
    const [r] = await db
        .select({ ...rowColumns, body: notes.body })
        .from(notes)
        .where(and(eq(notes.id, id), eq(notes.userId, userId)))
        .limit(1)
    return r ? { ...toRow(r), body: r.body } : null
}

/** Monday 00:00 UTC of the week holding `d` - the same boundary as Postgres `date_trunc('week', ...)`. */
function weekStartUtc(d: Date): Date {
    const day = d.getUTCDay() // 0 = Sunday
    const back = (day + 6) % 7
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back))
}

/** The chart's window. The SQL below says `interval '7 weeks'` (this week plus seven) - change both together. */
const WEEKS = 8

/**
 * The band and the chart in ONE round trip: the four counts in one statement (`count(*) filter`), the weekly buckets,
 * and the tags in use. Weeks with no notes come back as 0 here - for "notes created" a 0 week IS the answer (nothing
 * was written), unlike a rate where no data is not a zero.
 */
export async function readNoteStats(userId: string): Promise<NoteStats> {
    const mine = eq(notes.userId, userId)
    const [counts, weeks, tagRows] = await db.batch([
        db
            .select({
                active: sql<number>`count(*) filter (where ${notes.archivedAt} is null)::int`,
                pinned: sql<number>`count(*) filter (where ${notes.archivedAt} is null and ${notes.pinned})::int`,
                editedLast7: sql<number>`count(*) filter (where ${notes.updatedAt} >= now() - interval '7 days')::int`,
                archived: sql<number>`count(*) filter (where ${notes.archivedAt} is not null)::int`,
            })
            .from(notes)
            .where(mine),
        db
            .select({
                week: sql<string>`to_char(date_trunc('week', ${notes.createdAt}), 'YYYY-MM-DD')`,
                n: sql<number>`count(*)::int`,
            })
            .from(notes)
            .where(and(mine, sql`${notes.createdAt} >= date_trunc('week', now()) - interval '7 weeks'`))
            .groupBy(sql`1`),
        db
            .selectDistinct({ tag: sql<string>`unnest(${notes.tags})` })
            .from(notes)
            .where(mine)
            .orderBy(sql`1`)
            .limit(200),
    ])

    const byWeek = new Map(weeks.map((w) => [w.week, w.n]))
    const thisWeek = weekStartUtc(new Date())
    const createdPerWeek: NoteWeekBucket[] = Array.from({ length: WEEKS }, (_, i) => {
        const start = new Date(thisWeek.getTime() - (WEEKS - 1 - i) * 7 * 86_400_000)
        const key = start.toISOString().slice(0, 10)
        return { weekStart: key, count: byWeek.get(key) ?? 0 }
    })

    const c = counts[0]
    return {
        active: c?.active ?? 0,
        pinned: c?.pinned ?? 0,
        editedLast7: c?.editedLast7 ?? 0,
        archived: c?.archived ?? 0,
        createdPerWeek,
        tags: tagRows.map((t) => t.tag).filter(Boolean),
    }
}
