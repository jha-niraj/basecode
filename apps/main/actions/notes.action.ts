"use server"

/**
 * Notes - the Server Actions. The pattern every module copies:
 *
 * - Every export checks the session ITSELF (`requireSession` throws AppError('auth'); `fail` turns it into a result).
 *   The layout's check is not enough: each export is a public endpoint on every route that imports this file.
 * - Every export returns `ActionResult<T>` through `ok` / `fail` / `failWith` - the client never sees a raw throw.
 * - Input is parsed with the zod schema from `schemas/notes.ts` (never defined here: a non-function export empties a
 *   'use server' module at build).
 * - Every query is filtered by the signed-in user's id; a write also matches it in the WHERE, so an id from someone
 *   else's note simply finds nothing.
 * - Reads live in `lib/notes.ts` (server-only) so the PDF document reads the same way. No revalidatePath: /notes
 *   reads through TanStack Query and every mutation invalidates `["notes"]` on the client.
 */
import { and, db, eq } from "@repo/db"
import { notes } from "@repo/db/schema"
import { fail, failWith, ok, type ActionResult } from "@repo/errors"
import { requireSession } from "@/lib/session"
import { readNote, readNotePage, readNoteStats } from "@/lib/notes"
import { noteIdSchema, noteInputSchema, noteListParamsSchema, noteUpdateSchema, type NoteInput, type NoteUpdateInput } from "@/schemas/notes"
import type { NoteDetail, NoteListPage, NoteListParams, NoteStats } from "@/types/notes"

const firstIssue = (issues: { message: string }[], fallback: string) => issues[0]?.message ?? fallback

export async function listNotes(params: NoteListParams): Promise<ActionResult<NoteListPage>> {
    try {
        const session = await requireSession()
        const p = noteListParamsSchema.parse(params)
        return ok(await readNotePage(session.user.id, p))
    } catch (err) {
        return fail(err)
    }
}

export async function getNote(id: string): Promise<ActionResult<NoteDetail>> {
    try {
        const session = await requireSession()
        const parsed = noteIdSchema.safeParse(id)
        if (!parsed.success) return failWith("validation", firstIssue(parsed.error.issues, "No note was given."))
        const note = await readNote(session.user.id, parsed.data)
        if (!note) return failWith("notfound", "This note was deleted, or it is not yours.")
        return ok(note)
    } catch (err) {
        return fail(err)
    }
}

export async function getNoteStats(): Promise<ActionResult<NoteStats>> {
    try {
        const session = await requireSession()
        return ok(await readNoteStats(session.user.id))
    } catch (err) {
        return fail(err)
    }
}

export async function createNote(input: NoteInput): Promise<ActionResult<{ id: string }>> {
    try {
        const session = await requireSession()
        const parsed = noteInputSchema.safeParse(input)
        if (!parsed.success) return failWith("validation", firstIssue(parsed.error.issues, "Check the note."))
        const [row] = await db
            .insert(notes)
            .values({ userId: session.user.id, ...parsed.data })
            .returning({ id: notes.id })
        if (!row) return failWith("unknown", "The note was not saved. Try again.")
        return ok({ id: row.id })
    } catch (err) {
        return fail(err)
    }
}

export async function updateNote(input: NoteUpdateInput): Promise<ActionResult<{ id: string }>> {
    try {
        const session = await requireSession()
        const parsed = noteUpdateSchema.safeParse(input)
        if (!parsed.success) return failWith("validation", firstIssue(parsed.error.issues, "Check the note."))
        const { id, ...values } = parsed.data
        const [row] = await db
            .update(notes)
            .set({ ...values, updatedAt: new Date() })
            .where(and(eq(notes.id, id), eq(notes.userId, session.user.id)))
            .returning({ id: notes.id })
        if (!row) return failWith("notfound", "This note was deleted, or it is not yours.")
        return ok({ id: row.id })
    } catch (err) {
        return fail(err)
    }
}

/** The inline pin toggle - one field, so it does not resend the whole note. */
export async function setNotePinned(id: string, pinned: boolean): Promise<ActionResult<{ id: string; pinned: boolean }>> {
    try {
        const session = await requireSession()
        const parsed = noteIdSchema.safeParse(id)
        if (!parsed.success) return failWith("validation", firstIssue(parsed.error.issues, "No note was given."))
        const [row] = await db
            .update(notes)
            .set({ pinned: Boolean(pinned), updatedAt: new Date() })
            .where(and(eq(notes.id, parsed.data), eq(notes.userId, session.user.id)))
            .returning({ id: notes.id, pinned: notes.pinned })
        if (!row) return failWith("notfound", "This note was deleted, or it is not yours.")
        return ok(row)
    } catch (err) {
        return fail(err)
    }
}

/** Archive (`archived: true`) or bring back (`false`). Archived notes are kept, out of the Active tab. */
export async function setNoteArchived(id: string, archived: boolean): Promise<ActionResult<{ id: string; archived: boolean }>> {
    try {
        const session = await requireSession()
        const parsed = noteIdSchema.safeParse(id)
        if (!parsed.success) return failWith("validation", firstIssue(parsed.error.issues, "No note was given."))
        const now = new Date()
        const [row] = await db
            .update(notes)
            .set({ archivedAt: archived ? now : null, updatedAt: now })
            .where(and(eq(notes.id, parsed.data), eq(notes.userId, session.user.id)))
            .returning({ id: notes.id })
        if (!row) return failWith("notfound", "This note was deleted, or it is not yours.")
        return ok({ id: row.id, archived: Boolean(archived) })
    } catch (err) {
        return fail(err)
    }
}

export async function deleteNote(id: string): Promise<ActionResult<{ id: string }>> {
    try {
        const session = await requireSession()
        const parsed = noteIdSchema.safeParse(id)
        if (!parsed.success) return failWith("validation", firstIssue(parsed.error.issues, "No note was given."))
        const [row] = await db
            .delete(notes)
            .where(and(eq(notes.id, parsed.data), eq(notes.userId, session.user.id)))
            .returning({ id: notes.id })
        if (!row) return failWith("notfound", "This note was already deleted.")
        return ok({ id: row.id })
    } catch (err) {
        return fail(err)
    }
}
