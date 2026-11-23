"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { ActionResult } from "@repo/errors"
import { toast } from "@repo/ui/components/ui/toast"
import { createNote, deleteNote, setNoteArchived, setNotePinned, updateNote } from "@/actions/notes.action"
import type { NoteInput } from "@/schemas/notes"
import { NOTE_KEYS } from "./notes-query"

/** An ActionResult failure becomes a throw, so `mutateAsync` rejects (and a ConfirmPopover stays open beside it). */
function unwrap<T>(r: ActionResult<T>, fallback: string): T {
    if (!r.success) throw new Error(r.error ?? fallback)
    return r.data
}

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

/**
 * Every write the Notes page makes, in one hook the grid and the sheet share. Each one, on success, INVALIDATES
 * `["notes"]` (list pages, the band, open notes) - never a hand-spliced cache - and toasts what happened in the words of
 * the button that did it. Errors toast the server's sentence.
 */
export function useNoteMutations() {
    const queryClient = useQueryClient()
    const refresh = () => queryClient.invalidateQueries({ queryKey: NOTE_KEYS.all })

    const save = useMutation({
        mutationFn: async (input: NoteInput & { id?: string }) => {
            const { id, ...values } = input
            return id
                ? unwrap(await updateNote({ id, ...values }), "The note was not saved.")
                : unwrap(await createNote(values), "The note was not saved.")
        },
        onSuccess: async (_d, input) => {
            toast.success(input.id ? "Note saved" : "Note created")
            await refresh()
        },
        onError: (e) => toast.error(message(e, "The note was not saved.")),
    })

    const pin = useMutation({
        mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => unwrap(await setNotePinned(id, pinned), "Could not change the pin."),
        onSuccess: async (d) => {
            toast.success(d.pinned ? "Pinned" : "Unpinned")
            await refresh()
        },
        onError: (e) => toast.error(message(e, "Could not change the pin.")),
    })

    const archive = useMutation({
        mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => unwrap(await setNoteArchived(id, archived), "Could not archive the note."),
        onSuccess: async (d) => {
            toast.success(d.archived ? "Note archived" : "Note moved back to Active")
            await refresh()
        },
        onError: (e) => toast.error(message(e, "Could not archive the note.")),
    })

    const remove = useMutation({
        mutationFn: async (id: string) => unwrap(await deleteNote(id), "Could not delete the note."),
        onSuccess: async () => {
            toast.success("Note deleted")
            await refresh()
        },
        onError: (e) => toast.error(message(e, "Could not delete the note.")),
    })

    return { save, pin, archive, remove }
}
