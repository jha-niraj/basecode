"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Archive, ArchiveRestore, Trash2, X } from "lucide-react"
import { Button } from "@repo/ui/components/ui/button"
import { ConfirmPopover } from "@repo/ui/components/ui/confirm-popover"
import { InlineLoader } from "@repo/ui/components/ui/inline-loader"
import { InlineNote } from "@repo/ui/components/ui/inline-note"
import { Input } from "@repo/ui/components/ui/input"
import { Label } from "@repo/ui/components/ui/label"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet"
import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { Switch } from "@repo/ui/components/ui/switch"
import { Textarea } from "@repo/ui/components/ui/textarea"
import { getNote } from "@/actions/notes.action"
import { NOTE_BODY_MAX, NOTE_TAG_MAX, NOTE_TAGS_MAX, NOTE_TITLE_MAX, noteInputSchema, type NoteInput } from "@/schemas/notes"
import type { NoteDetail, NoteRow } from "@/types/notes"
import { formatNoteDate, TagChip } from "./note-bits"
import { NOTE_KEYS } from "./notes-query"
import { useNoteMutations } from "./use-note-mutations"

/** What the sheet shows: the create form, or one note. `null` once it has slid out. */
export type NoteSheetTarget = { mode: "new" } | { mode: "edit"; row: NoteRow }

async function fetchNote(id: string): Promise<NoteDetail> {
    const r = await getNote(id)
    // Throw in queryFn on failure: TanStack then owns the error state (and its retry).
    if (!r.success) throw new Error(r.error ?? "Could not open the note.")
    return r.data
}

/**
 * Create and edit in ONE keep-open, non-modal right sheet (the house rule for a list item with 2+ fields).
 *
 * - It opens AT ONCE with the row's own fields (the title in the header) and reads the full body by id; the form waits
 *   for it behind a skeleton shaped like the form. A deep link seeds that read with the server's copy (`initialDetail`).
 * - Pressing another row SWAPS the note: the grid carries `data-sheet-keep-open`, so the press is not an outside click.
 * - The form is KEYED by the note id, so a swap mounts a fresh form from the new note - no effect copying async data
 *   into editable state (which clobbers typing when a refetch lands).
 * - Content resets in `onExitComplete` (the parent clears `target`), never in `onOpenChange(false)`: cleared on close,
 *   the panel would collapse while it is still sliding out.
 * - With unsaved changes a stray outside click is ignored (`guardOutside`) and the Cancel button flashes.
 */
export function NoteSheet({ target, open, onOpenChange, onExitComplete, initialDetail }: {
    target: NoteSheetTarget | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onExitComplete: () => void
    initialDetail?: NoteDetail | null
}) {
    const id = target?.mode === "edit" ? target.row.id : null
    const detail = useQuery({
        queryKey: NOTE_KEYS.detail(id ?? ""),
        queryFn: () => fetchNote(id as string),
        enabled: !!id && open,
        initialData: initialDetail && initialDetail.id === id ? initialDetail : undefined,
    })
    const [dirty, setDirty] = React.useState(false)
    // A swap to another note starts clean even before its form mounts (it may still be loading).
    React.useEffect(() => { setDirty(false) }, [id])

    const note = id ? detail.data : undefined
    const title = target?.mode === "edit" ? (note?.title ?? target.row.title) : "New note"
    const subtitle = target?.mode === "edit"
        ? `Edited ${formatNoteDate(note?.updatedAt ?? target.row.updatedAt, true)}`
        : "Saved to your notes. The AI page can read and write them too."

    return (
        <Sheet open={open} onOpenChange={onOpenChange} onExitComplete={() => { setDirty(false); onExitComplete() }}>
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-4"
                guardOutside={dirty}
                // A phone keyboard must not pop up the moment a sheet opens; with a mouse, typing can start at once.
                onOpenAutoFocus={(e) => { if (window.matchMedia("(pointer: coarse)").matches) e.preventDefault() }}
            >
                <SheetHeader>
                    <SheetTitle className="truncate">{title}</SheetTitle>
                    <SheetDescription className="truncate">{subtitle}</SheetDescription>
                </SheetHeader>

                {!target ? null : target.mode === "new" ? (
                    <NoteForm key="new" onDirtyChange={setDirty} onDone={() => onOpenChange(false)} />
                ) : note ? (
                    <NoteForm key={note.id} note={note} onDirtyChange={setDirty} onDone={() => onOpenChange(false)} />
                ) : detail.isError ? (
                    <InlineNote tone="danger">{detail.error instanceof Error ? detail.error.message : "Could not open the note."}</InlineNote>
                ) : (
                    <NoteFormSkeleton />
                )}
            </SheetContent>
        </Sheet>
    )
}

/** The form's shape while the note is read: title, tags, pinned, body, and the footer band. */
function NoteFormSkeleton() {
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="space-y-1.5"><Skeleton className="h-4 w-12 rounded" /><Skeleton className="h-9 w-full rounded-xl" /></div>
            <div className="space-y-1.5"><Skeleton className="h-4 w-10 rounded" /><Skeleton className="h-9 w-full rounded-xl" /></div>
            <Skeleton className="h-6 w-28 rounded-full" />
            <div className="space-y-1.5"><Skeleton className="h-4 w-10 rounded" /><Skeleton className="h-40 w-full rounded-xl" /></div>
            <div className="-mx-6 -mb-6 mt-auto flex justify-end gap-2 border-t border-neutral-200 px-6 py-3 dark:border-neutral-800">
                <Skeleton className="h-9 w-20 rounded-xl" />
                <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
        </div>
    )
}

const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i])

function NoteForm({ note, onDirtyChange, onDone }: {
    /** Absent = the create form. */
    note?: NoteDetail
    onDirtyChange: (dirty: boolean) => void
    onDone: () => void
}) {
    const initial: NoteInput = note
        ? { title: note.title, body: note.body, tags: note.tags, pinned: note.pinned }
        : { title: "", body: "", tags: [], pinned: false }
    const [title, setTitle] = React.useState(initial.title)
    const [body, setBody] = React.useState(initial.body)
    const [tags, setTags] = React.useState<string[]>(initial.tags)
    const [tagDraft, setTagDraft] = React.useState("")
    const [pinned, setPinned] = React.useState(initial.pinned)
    const [error, setError] = React.useState<string | null>(null)
    const { save, archive, remove } = useNoteMutations()

    const dirty = title !== initial.title || body !== initial.body || !sameTags(tags, initial.tags) || pinned !== initial.pinned || tagDraft.trim() !== ""
    React.useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])

    /** The tag typed but not yet added counts too - pressing Save should not drop it. */
    const withDraft = (list: string[]) => {
        const t = tagDraft.trim().toLowerCase().replace(/,+$/, "")
        return t && !list.includes(t) ? [...list, t] : list
    }
    const addDraft = () => {
        setTags((list) => withDraft(list))
        setTagDraft("")
    }

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        const parsed = noteInputSchema.safeParse({ title, body, tags: withDraft(tags), pinned })
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Check the note.")
            return
        }
        setError(null)
        try {
            await save.mutateAsync({ id: note?.id, ...parsed.data })
            onDirtyChange(false)
            onDone()
        } catch {
            // The mutation toasted the server's sentence; the form stays as typed.
        }
    }

    const busy = save.isPending || archive.isPending || remove.isPending

    return (
        // The form wraps the scroller AND the footer, so Save never scrolls out of reach on a long note.
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col gap-4" noValidate>
            <ScrollArea orientation="vertical" className="-mx-6 min-h-0 flex-1">
                <div className="flex flex-col gap-4 px-6 pb-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="note-title">Title</Label>
                        <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={NOTE_TITLE_MAX} placeholder="What is this note about?" className="h-9 rounded-xl text-sm" />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="note-tags">Tags</Label>
                        <Input
                            id="note-tags"
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value.slice(0, NOTE_TAG_MAX + 1))}
                            onKeyDown={(e) => {
                                // Enter or a comma adds the tag (and never submits the form); Backspace on an empty box
                                // removes the last one.
                                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addDraft() }
                                else if (e.key === "Backspace" && tagDraft === "" && tags.length > 0) setTags((l) => l.slice(0, -1))
                            }}
                            onBlur={addDraft}
                            disabled={tags.length >= NOTE_TAGS_MAX}
                            placeholder={tags.length >= NOTE_TAGS_MAX ? `${NOTE_TAGS_MAX} tags is the most` : "Type a tag and press Enter"}
                            className="h-9 rounded-xl text-sm"
                        />
                        {tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {tags.map((t) => (
                                    <TagChip key={t} className="gap-1 pr-1">
                                        {t}
                                        <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${t}`} onClick={() => setTags((l) => l.filter((x) => x !== t))} className="h-4 w-4 cursor-pointer rounded-full p-0">
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </TagChip>
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch id="note-pinned" checked={pinned} onCheckedChange={setPinned} />
                        <Label htmlFor="note-pinned" className="cursor-pointer">Pin to the top of the list</Label>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="note-body">Note</Label>
                        {/* Grows with its content (field-sizing), and the sheet's scroller takes the overflow. */}
                        <Textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={NOTE_BODY_MAX} placeholder="Write anything." className="min-h-40 rounded-xl text-sm field-sizing-content" />
                    </div>

                    {error ? <InlineNote tone="danger">{error}</InlineNote> : null}
                    {note?.archivedAt ? <InlineNote>Archived on {formatNoteDate(note.archivedAt)}. It stays here until you delete it.</InlineNote> : null}
                </div>
            </ScrollArea>

            <SheetFooter>
                {note ? (
                    // Routine, one-note actions confirm in a popover on the button - never a dialog.
                    <div className="flex items-center gap-2 sm:mr-auto">
                        <ConfirmPopover
                            title="Delete this note?"
                            description="It is removed for good. Archive it instead to keep it."
                            confirmLabel="Delete"
                            side="top"
                            align="start"
                            onConfirm={async () => { await remove.mutateAsync(note.id); onDirtyChange(false); onDone() }}
                        >
                            <Button type="button" variant="outline" disabled={busy} className="cursor-pointer gap-1.5 rounded-xl">
                                <Trash2 className="h-4 w-4" />Delete
                            </Button>
                        </ConfirmPopover>
                        {note.archivedAt ? (
                            <Button type="button" variant="outline" disabled={busy} onClick={async () => { try { await archive.mutateAsync({ id: note.id, archived: false }); onDirtyChange(false); onDone() } catch { /* toasted */ } }} className="cursor-pointer gap-1.5 rounded-xl">
                                {archive.isPending ? <InlineLoader size={14} label="Restoring" /> : <ArchiveRestore className="h-4 w-4" />}Move to Active
                            </Button>
                        ) : (
                            <ConfirmPopover
                                title="Archive this note?"
                                description="It moves to the Archived tab. You can bring it back."
                                confirmLabel="Archive"
                                destructive={false}
                                side="top"
                                align="start"
                                onConfirm={async () => { await archive.mutateAsync({ id: note.id, archived: true }); onDirtyChange(false); onDone() }}
                            >
                                <Button type="button" variant="outline" disabled={busy} className="cursor-pointer gap-1.5 rounded-xl">
                                    <Archive className="h-4 w-4" />Archive
                                </Button>
                            </ConfirmPopover>
                        )}
                    </div>
                ) : null}
                <Button type="button" variant="outline" data-sheet-cancel="" onClick={onDone} className="cursor-pointer rounded-xl">Cancel</Button>
                <Button type="submit" disabled={busy || (!!note && !dirty)} className="cursor-pointer gap-1.5 rounded-xl">
                    {save.isPending ? <InlineLoader size={14} label="Saving" /> : null}
                    {note ? "Save changes" : "Create note"}
                </Button>
            </SheetFooter>
        </form>
    )
}
