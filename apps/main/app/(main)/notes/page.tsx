import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { readNote, readNotePage, readNoteStats } from "@/lib/notes"
import { ROUTES } from "@/lib/navigation"
import { getSession } from "@/lib/session"
import type { NoteDetail } from "@/types/notes"
import { NotesClient } from "./_components/notes-client"
import { parseNoteParams, parseOpenParam } from "./_components/notes-query"

export const metadata: Metadata = { title: "Notes" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** A failed read becomes "no initial data": the client then fetches it itself and shows the error inline. */
async function settle<T>(p: Promise<T>, label: string): Promise<T | undefined> {
    try {
        return await p
    } catch (err) {
        console.error(`[notes] ${label} failed on the server:`, err instanceof Error ? err.message : err)
        return undefined
    }
}

/**
 * The hybrid page: the server checks the session, parses the URL with the SAME parser the client writes it with, and
 * starts every read at once (list, band, the `?open=` note). The client's `useQuery` gets them as `initialData` under
 * the same keys, so the first paint is complete and a later visit returns from the cache. loading.tsx paints the
 * skeleton while these run; nothing here waits on anything else.
 */
export default async function NotesPage({ searchParams }: { searchParams: SearchParams }) {
    const session = await getSession()
    if (!session) redirect(`${ROUTES.signIn}?stale=1&returnTo=${ROUTES.notes}`)
    const userId = session.user.id
    const sp = await searchParams
    const params = parseNoteParams(sp)
    const open = parseOpenParam(sp)
    const openId = open && open !== "new" ? open : null

    const [list, stats, opened] = await Promise.all([
        settle(readNotePage(userId, params), "list"),
        settle(readNoteStats(userId), "stats"),
        openId ? settle(readNote(userId, openId), "open") : Promise.resolve(null),
    ])

    const initialOpen: NoteDetail | "new" | null = open === "new" ? "new" : (opened ?? null)

    return (
        <NotesClient
            initialParams={params}
            initialList={list}
            initialStats={stats}
            initialOpen={initialOpen}
            openMissing={!!openId && opened === null}
        />
    )
}
