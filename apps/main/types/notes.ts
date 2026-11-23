/**
 * Notes - the shapes that cross the server/client line. Plain data only (ISO strings, not Dates): the same object is
 * passed as `initialData` from the server page and returned by the Server Action, so both sides of the cache agree.
 */

export type NoteTab = "active" | "archived"
export type NotePinnedFilter = "yes" | "no"

/** Everything the list depends on. It IS the query key and the URL (see `notes-query.ts`). */
export interface NoteListParams {
    tab: NoteTab
    /** Matches title or body, case-insensitive. Empty = no search. */
    q: string
    /** Any of these tags. Empty = no tag filter. */
    tags: string[]
    pinned: NotePinnedFilter | null
    page: number
}

/** One row of the grid. `preview` is the start of the body - the list never ships whole bodies. */
export interface NoteRow {
    id: string
    title: string
    preview: string
    tags: string[]
    pinned: boolean
    archivedAt: string | null
    createdAt: string
    updatedAt: string
}

/** One note in the sheet: the row plus the full body. */
export interface NoteDetail extends NoteRow {
    body: string
}

export interface NoteListPage {
    items: NoteRow[]
    total: number
    page: number
    pages: number
    pageSize: number
}

export interface NoteWeekBucket {
    /** Monday of the week, `YYYY-MM-DD` (UTC). */
    weekStart: string
    count: number
}

/** The band and the chart. Every figure names its window (AGENTS.md section 9). */
export interface NoteStats {
    /** Not archived, all time. */
    active: number
    /** Pinned and not archived. */
    pinned: number
    /** Any note (active or archived) changed in the last 7 days. */
    editedLast7: number
    archived: number
    /** Notes created per week, the last 8 weeks oldest first, empty weeks included as 0. */
    createdPerWeek: NoteWeekBucket[]
    /** Every tag in use (the tag filter's options), alphabetical. */
    tags: string[]
}
