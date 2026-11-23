import { z } from 'zod'

/**
 * Notes - input schemas. They live here, never in the 'use server' file (a non-function export empties that module at
 * build). The sheet's form and the actions parse with the SAME schema, so a limit is said once.
 */

export const NOTE_TITLE_MAX = 120
export const NOTE_BODY_MAX = 20_000
export const NOTE_TAG_MAX = 32
export const NOTE_TAGS_MAX = 10
export const NOTES_PAGE_SIZE = 25

/** Tags are lower-cased, trimmed and de-duplicated, so "Work" and "work " are one tag in the filter. */
const tags = z
    .array(z.string())
    .transform((list) => [...new Set(list.map((t) => t.trim().toLowerCase()).filter(Boolean))])
    .pipe(
        z
            .array(z.string().max(NOTE_TAG_MAX, `Keep each tag under ${NOTE_TAG_MAX} characters.`))
            .max(NOTE_TAGS_MAX, `Use at most ${NOTE_TAGS_MAX} tags.`),
    )

export const noteInputSchema = z.object({
    title: z.string().trim().min(1, 'Give the note a title.').max(NOTE_TITLE_MAX, `Keep the title under ${NOTE_TITLE_MAX} characters.`),
    body: z.string().max(NOTE_BODY_MAX, `Keep the note under ${NOTE_BODY_MAX.toLocaleString()} characters.`),
    tags,
    pinned: z.boolean(),
})

export const noteUpdateSchema = noteInputSchema.extend({ id: z.string().min(1) })

export const noteIdSchema = z.string().min(1, 'No note was given.')

/** The list's params as the action receives them. Out-of-range values are clamped, not rejected (a stale link). */
export const noteListParamsSchema = z.object({
    tab: z.enum(['active', 'archived']).catch('active'),
    q: z.string().trim().max(200).catch(''),
    tags: z.array(z.string().trim().toLowerCase().max(NOTE_TAG_MAX)).max(NOTE_TAGS_MAX).catch([]),
    pinned: z.enum(['yes', 'no']).nullable().catch(null),
    page: z.number().int().min(1).max(10_000).catch(1),
})

export type NoteInput = z.infer<typeof noteInputSchema>
export type NoteUpdateInput = z.infer<typeof noteUpdateSchema>
