"use client"

import * as React from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useTable, type ColumnDef } from "@tanstack/react-table"
import { Archive, ArchiveRestore, FileText, ListFilter, NotebookPen, PanelRightOpen, PencilLine, Pin, Plus, RotateCw, Search, SearchX, MessagesSquare, Trash2 } from "lucide-react"
import type { CsvColumn } from "@repo/core/csv"
import { useRouter } from "next/navigation"
import { AppLink, markNavPending } from "@repo/ui/components/app-link"
import { CategoryBarChart, ChartPanel } from "@repo/ui/components/charts/panel-charts"
import { ExportCsvButton } from "@repo/ui/components/export-csv-button"
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures } from "@repo/ui/components/reui/data-grid/data-grid"
import { DataGridScrollArea } from "@repo/ui/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@repo/ui/components/reui/data-grid/data-grid-table"
import { Filters } from "@repo/ui/components/reui/filters/filters"
import { countFilterRules, createFilterQuery } from "@repo/ui/components/reui/filters/filters-query"
import type { FilterQuery } from "@repo/ui/components/reui/filters/filters-types"
import { Button } from "@repo/ui/components/ui/button"
import { ConfirmPopover } from "@repo/ui/components/ui/confirm-popover"
import { EmptyState } from "@repo/ui/components/ui/empty-state"
import { InlineLoader } from "@repo/ui/components/ui/inline-loader"
import { InlineNote } from "@repo/ui/components/ui/inline-note"
import { Input } from "@repo/ui/components/ui/input"
import { ListPagination } from "@repo/ui/components/ui/list-pagination"
import { Page } from "@repo/ui/components/ui/page"
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover"
import { StatBand } from "@repo/ui/components/ui/stat-band"
import { toast } from "@repo/ui/components/ui/toast"
import { useDebounce } from "@repo/ui/hooks/use-debounce"
import { cn } from "@repo/ui/lib/utils"
import { getNoteStats, listNotes } from "@/actions/notes.action"
import { ROUTES } from "@/lib/navigation"
import type { NoteDetail, NoteListPage, NoteListParams, NoteRow, NoteStats } from "@/types/notes"
import { formatNoteDate, formatWeekLabel, TagList } from "./note-bits"
import { NoteSheet, type NoteSheetTarget } from "./note-sheet"
import {
    NOTE_KEYS, NOTE_TABS, noteFilterFields, noteFilterQuery, noteFiltersFromQuery, noteParamsToSearch, notesPdfHref, sameNoteParams,
} from "./notes-query"
import { NOTES_DESCRIPTION, NOTES_GRID, NOTES_TITLE, NotesSkeleton } from "./notes-skeleton"
import { useNoteMutations } from "./use-note-mutations"

// queryFns THROW on a failed ActionResult, so TanStack owns the error state and the retry.
async function fetchList(params: NoteListParams): Promise<NoteListPage> {
    const r = await listNotes(params)
    if (!r.success) throw new Error(r.error ?? "Could not load your notes.")
    return r.data
}
async function fetchStats(): Promise<NoteStats> {
    const r = await getNoteStats()
    if (!r.success) throw new Error(r.error ?? "Could not load the counts.")
    return r.data
}

const CSV_COLUMNS: CsvColumn<NoteRow>[] = [
    { header: "Title", value: (r) => r.title },
    { header: "Start of the note", value: (r) => r.preview },
    { header: "Tags", value: (r) => r.tags.join(", ") },
    { header: "Pinned", value: (r) => (r.pinned ? "Yes" : "No") },
    { header: "Archived", value: (r) => (r.archivedAt ? formatNoteDate(r.archivedAt) : "") },
    { header: "Edited", value: (r) => formatNoteDate(r.updatedAt, true) },
    { header: "Created", value: (r) => formatNoteDate(r.createdAt, true) },
]

/**
 * /notes - THE reference list module. What to copy, top to bottom:
 *
 * 1. STATE IN THE URL, NOT IN A ROUTER CALL. Tab, search, chips and page are React state mirrored into the URL with
 *    `history.replaceState` - a reload or a shared link lands on the same view, and nothing re-runs the server page
 *    (`router.replace` of the same page would). The server parsed the same URL with the same parser
 *    (`parseNoteParams`) and seeded `initialData` under the same key, so the first paint needs no client fetch.
 * 2. A URL-KEYED QUERY. The list's key IS its params; a new search or chip is a new key, fetched through the Server
 *    Action, with `keepPreviousData` and the grid dimmed meanwhile - never a blank list or a skeleton flash.
 * 3. ONE SKELETON. The client's loading branch renders the same `NotesSkeleton` as loading.tsx.
 * 4. A LIST WITH A CEILING. The grid is content height up to ~10 rows, then scrolls inside its own bounded area, with a
 *    sticky header and the row actions pinned to the END. Pagination sits outside the scroller; its buttons disable.
 * 5. ONE KEEP-OPEN SHEET for create and edit; the grid carries `data-sheet-keep-open`, so another row swaps it.
 * 6. ROUTINE CONFIRMS IN A POPOVER on the button (archive, delete); pin is a one-click toggle.
 * 7. MUTATIONS INVALIDATE `["notes"]`. Failed refreshes keep the page and say so in an inline note.
 * 8. NOTHING TO SHOW SHOWS NOTHING: a person with no notes sees one empty state, not a band of zeros.
 */
export function NotesClient({ initialParams, initialList, initialStats, initialOpen, openMissing }: {
    initialParams: NoteListParams
    initialList?: NoteListPage
    initialStats?: NoteStats
    /** `?open=` resolved on the server: a note, the create form, or nothing. */
    initialOpen: NoteDetail | "new" | null
    /** `?open=<id>` named a note that is not there (deleted, or someone else's). */
    openMissing: boolean
}) {
    const router = useRouter()
    const [params, setParams] = React.useState<NoteListParams>(initialParams)
    const [search, setSearch] = React.useState(initialParams.q)
    const debounced = useDebounce(search.trim(), 300)
    const [query, setQuery] = React.useState<FilterQuery>(() => noteFilterQuery(initialParams))
    const [target, setTarget] = React.useState<NoteSheetTarget | null>(() =>
        initialOpen === "new" ? { mode: "new" } : initialOpen ? { mode: "edit", row: initialOpen } : null)
    const [sheetOpen, setSheetOpen] = React.useState(initialOpen !== null)

    // A settled search is a new view, from page 1.
    React.useEffect(() => {
        setParams((p) => (p.q === debounced ? p : { ...p, q: debounced, page: 1 }))
    }, [debounced])

    // The URL mirrors the view (and the open note, so a reload reopens it). replaceState: no history entry per
    // keystroke, and Next folds it into its router, so nothing on the server runs.
    const openParam = sheetOpen && target ? (target.mode === "new" ? "new" : target.row.id) : null
    React.useEffect(() => {
        const qs = noteParamsToSearch(params, openParam)
        const next = qs ? `${ROUTES.notes}?${qs}` : ROUTES.notes
        if (`${window.location.pathname}${window.location.search}` !== next) window.history.replaceState(null, "", next)
    }, [params, openParam])

    React.useEffect(() => {
        if (openMissing) toast.info("That note is not here any more. It may have been deleted.")
    }, [openMissing])

    const list = useQuery({
        queryKey: NOTE_KEYS.list(params),
        queryFn: () => fetchList(params),
        // Only the view the server rendered has server data; any other key starts empty and fetches.
        initialData: sameNoteParams(params, initialParams) ? initialList : undefined,
        placeholderData: keepPreviousData,
    })
    const stats = useQuery({ queryKey: NOTE_KEYS.stats, queryFn: fetchStats, initialData: initialStats })

    // A page past the end (the last note on it was deleted, or a stale link) steps back to the last real page.
    const lastPage = list.data && !list.isPlaceholderData ? list.data.pages : null
    React.useEffect(() => {
        if (lastPage !== null && params.page > lastPage) setParams((p) => ({ ...p, page: lastPage }))
    }, [lastPage, params.page])

    const openRow = React.useCallback((row: NoteRow) => {
        setTarget({ mode: "edit", row })
        setSheetOpen(true)
    }, [])
    const openNew = React.useCallback(() => {
        setTarget({ mode: "new" })
        setSheetOpen(true)
    }, [])

    const rows = React.useMemo(() => list.data?.items ?? [], [list.data])

    // Headers do not sort: the list is paged on the server, and sorting one page of it would mislead. The order is
    // fixed and said nowhere because it is the obvious one - pinned first, then the latest edit.
    const columns = React.useMemo<ColumnDef<DataGridFeatures, NoteRow>[]>(() => [
        {
            id: "pin",
            header: () => <span className="sr-only">Pinned</span>,
            cell: ({ row }) => <PinToggle row={row.original} />,
            size: 52,
            enableSorting: false,
            enableHiding: false,
        },
        {
            id: "title",
            accessorFn: (r) => r.title,
            header: "Note",
            cell: ({ row }) => (
                <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">{row.original.title}</p>
                    <p className="truncate text-xs text-neutral-600 dark:text-neutral-400">{row.original.preview.split("\n")[0] || "No text yet"}</p>
                </div>
            ),
            size: 380,
            enableSorting: false,
            enableHiding: false,
        },
        {
            id: "tags",
            header: "Tags",
            cell: ({ row }) => <TagList tags={row.original.tags} />,
            size: 200,
            enableSorting: false,
        },
        {
            id: "edited",
            header: "Edited",
            cell: ({ row }) => <span className="text-sm text-neutral-600 dark:text-neutral-400">{formatNoteDate(row.original.updatedAt)}</span>,
            size: 130,
            enableSorting: false,
        },
        {
            id: "created",
            header: "Created",
            cell: ({ row }) => <span className="text-sm text-neutral-600 dark:text-neutral-400">{formatNoteDate(row.original.createdAt)}</span>,
            size: 130,
            enableSorting: false,
        },
        {
            id: "actions",
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => <RowActions row={row.original} onOpen={openRow} />,
            size: 132,
            enableSorting: false,
            enableHiding: false,
        },
    ], [openRow])

    const table = useTable({
        features: dataGridFeatures,
        columns,
        data: rows,
        getRowId: (r: NoteRow) => r.id,
        // The server pages the list; the grid's own pagination is off.
        manualPagination: true,
        initialState: { columnPinning: { start: [], end: ["actions"] } },
    })

    // Every hook is above this line - an early return before a hook is the #1 conversion bug.
    if (list.isPending && !list.data) return <NotesSkeleton />

    const s = stats.data
    const total = list.data?.total ?? 0
    const chipCount = countFilterRules(query)
    const filtering = params.q !== "" || params.tags.length > 0 || params.pinned !== null
    // Unknown counts (the band failed) are treated as "has notes", so a failed read never shows the first-run screen.
    const hasAnyNote = s ? s.active + s.archived > 0 : true
    const firstRun = !hasAnyNote && !filtering && rows.length === 0
    const height = Math.min(NOTES_GRID.maxH, NOTES_GRID.headH + Math.max(rows.length, 1) * NOTES_GRID.rowH + 12)

    const setTab = (tab: string) => setParams((p) => ({ ...p, tab: tab === "archived" ? "archived" : "active", page: 1 }))
    const clearFilters = () => {
        setSearch("")
        setQuery(createFilterQuery([]))
        setParams((p) => ({ ...p, q: "", tags: [], pinned: null, page: 1 }))
    }
    const onQueryChange = (next: FilterQuery) => {
        setQuery(next)
        const f = noteFiltersFromQuery(next)
        setParams((p) => (p.tags.join(",") === f.tags.join(",") && p.pinned === f.pinned ? p : { ...p, ...f, page: 1 }))
    }

    const filtersBar = (
        <Filters fields={noteFilterFields(s?.tags ?? [])} query={query} onQueryChange={onQueryChange} variant="basic" size="sm" showClear />
    )
    const exports = (
        <>
            <ExportCsvButton
                rows={rows}
                columns={CSV_COLUMNS}
                filenameBase="notes"
                // No silent caps: the file holds what is on screen, and the button says so.
                title={`Exports the ${rows.length} notes on this page. The PDF has every note in this view.`}
                className="cursor-pointer rounded-xl"
            />
            {total > 0 ? (
                <Button asChild variant="outline" size="sm" className="cursor-pointer gap-1.5 rounded-xl">
                    {/* A document, not an app page: a plain link (AppLink is for routes the app prefetches). */}
                    <a href={notesPdfHref(params)} target="_blank" rel="noopener" title="Every note in this view, as a PDF">
                        <FileText className="h-4 w-4" />PDF
                    </a>
                </Button>
            ) : (
                <Button variant="outline" size="sm" disabled className="gap-1.5 rounded-xl"><FileText className="h-4 w-4" />PDF</Button>
            )}
        </>
    )

    return (
        <Page
            title={NOTES_TITLE}
            description={NOTES_DESCRIPTION}
            icon={<NotebookPen />}
            tabs={NOTE_TABS}
            tab={params.tab}
            onTabChange={setTab}
            // One "New note" with its two ways in - a split button (clean controls, owner 2026-11-23, after runable.com).
            actions={[{
                key: "new", label: "New note", icon: <Plus className="h-3.5 w-3.5" />, primary: true, keepSheetOpen: true,
                options: [
                    { key: "write", label: "Write it yourself", icon: <PencilLine />, onClick: openNew },
                    { key: "ai", label: "Draft it with the AI", icon: <MessagesSquare />, onClick: () => { markNavPending(ROUTES.ai); router.push(ROUTES.ai) } },
                ],
            }]}
        >
            {firstRun ? (
                <EmptyState
                    bordered
                    icon={<NotebookPen />}
                    title="No notes yet"
                    description="Write your first note here, or ask the AI to draft one - notes it saves land on this page."
                    action={(
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button onClick={openNew} data-sheet-keep-open="" className="cursor-pointer gap-1.5 rounded-xl"><Plus className="h-4 w-4" />New note</Button>
                            <Button asChild variant="outline" className="cursor-pointer gap-1.5 rounded-xl">
                                <AppLink href={ROUTES.ai}><MessagesSquare className="h-4 w-4" />Ask the AI</AppLink>
                            </Button>
                        </div>
                    )}
                />
            ) : (
                <>
                    <StatBand
                        items={[
                            { icon: NotebookPen, label: "Notes", value: s ? s.active.toLocaleString() : "-", hint: "not archived", onClick: () => setTab("active"), active: params.tab === "active" },
                            { icon: Pin, label: "Pinned", value: s ? s.pinned.toLocaleString() : "-" },
                            { icon: PencilLine, label: "Edited", value: s ? s.editedLast7.toLocaleString() : "-", hint: "last 7 days" },
                            { icon: Archive, label: "Archived", value: s ? s.archived.toLocaleString() : "-", onClick: () => setTab("archived"), active: params.tab === "archived" },
                        ]}
                    />

                    {/* The one chart: a trend the band cannot show. Amber marks this week. */}
                    <ChartPanel title="Notes written" hint="per week, last 8 weeks">
                        {s ? (
                            <CategoryBarChart
                                bars={s.createdPerWeek.map((w) => ({ label: formatWeekLabel(w.weekStart), value: w.count }))}
                                highlightLabel={s.createdPerWeek.length ? formatWeekLabel(s.createdPerWeek[s.createdPerWeek.length - 1]!.weekStart) : undefined}
                                emptyMessage="No notes written in the last 8 weeks."
                                name="Notes"
                            />
                        ) : (
                            <InlineNote>The weekly counts could not be loaded.</InlineNote>
                        )}
                    </ChartPanel>

                    <DataGrid
                        table={table}
                        recordCount={total}
                        onRowClick={openRow}
                        emptyMessage="No notes here."
                        tableLayout={{ headerSticky: true, headerBackground: true, columnsPinnable: true, width: "fixed" }}
                    >
                        <div className="flex min-w-0 flex-col gap-3">
                            {/* Toolbar: search, filters, exports. One row on a phone: search + ONE menu button. */}
                            <div className="flex min-w-0 items-center gap-2">
                                <div className="relative min-w-0 flex-1 sm:max-w-xs sm:flex-none sm:basis-80">
                                    <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes" aria-label="Search notes" className="h-9 rounded-xl pl-9" />
                                </div>
                                <div className="hidden min-w-0 flex-1 sm:block">{filtersBar}</div>
                                <div className="hidden shrink-0 items-center gap-2 sm:flex">{exports}</div>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="sm" className="shrink-0 cursor-pointer gap-1.5 rounded-xl sm:hidden" aria-label="Filters and export">
                                            <ListFilter className="h-4 w-4" />
                                            {chipCount > 0 ? <span className="tabular-nums">{chipCount}</span> : null}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="flex w-[min(92vw,22rem)] flex-col gap-3">
                                        <div>
                                            <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">Filters</p>
                                            {filtersBar}
                                        </div>
                                        <div>
                                            <p className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">Export</p>
                                            <div className="flex flex-wrap gap-2">{exports}</div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {list.isError ? (
                                // The page stays; the note says what failed and offers the retry.
                                <InlineNote tone="danger" className="items-center">
                                    <span className="flex flex-wrap items-center gap-2">
                                        {list.data ? "Could not refresh the list - showing the last one loaded." : list.error instanceof Error ? list.error.message : "Could not load your notes."}
                                        <Button size="sm" variant="outline" onClick={() => list.refetch()} disabled={list.isFetching} className="cursor-pointer gap-1.5 rounded-xl">
                                            {list.isFetching ? <InlineLoader size={14} label="Retrying" /> : <RotateCw className="h-3.5 w-3.5" />}Try again
                                        </Button>
                                    </span>
                                </InlineNote>
                            ) : null}

                            {rows.length === 0 && !list.isFetching && !list.isError ? (
                                filtering ? (
                                    <EmptyState bordered icon={<SearchX />} title="No notes match" description="Change the search or remove a filter."
                                        action={<Button variant="outline" onClick={clearFilters} className="cursor-pointer rounded-xl">Clear search and filters</Button>} />
                                ) : params.tab === "archived" ? (
                                    <EmptyState bordered icon={<Archive />} title="Nothing archived" description="Notes you archive wait here until you bring them back or delete them." />
                                ) : (
                                    <EmptyState bordered icon={<NotebookPen />} title="No active notes" description="Everything is archived. Write a new note, or open the Archived tab."
                                        action={<Button onClick={openNew} data-sheet-keep-open="" className="cursor-pointer gap-1.5 rounded-xl"><Plus className="h-4 w-4" />New note</Button>} />
                                )
                            ) : rows.length > 0 ? (
                                // The whole grid keeps an open sheet open: a press on another row SWAPS it.
                                <div data-sheet-keep-open="" className={cn("min-w-0 transition-opacity", list.isPlaceholderData && "opacity-60")}>
                                    <DataGridContainer className="rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-800">
                                        <DataGridScrollArea style={{ height }}>
                                            <DataGridTable />
                                        </DataGridScrollArea>
                                    </DataGridContainer>
                                </div>
                            ) : null}

                            {rows.length > 0 ? (
                                <ListPagination
                                    page={params.page}
                                    totalPages={list.data?.pages ?? 1}
                                    totalItems={total}
                                    itemNoun="notes"
                                    onPageChange={(page) => setParams((p) => ({ ...p, page }))}
                                    disabled={list.isFetching}
                                />
                            ) : null}
                        </div>
                    </DataGrid>
                </>
            )}

            <NoteSheet
                target={target}
                open={sheetOpen && !!target}
                onOpenChange={setSheetOpen}
                onExitComplete={() => setTarget(null)}
                initialDetail={initialOpen && initialOpen !== "new" ? initialOpen : null}
            />
        </Page>
    )
}

/** The inline pin: one click, its own pending state, the icon drawn from the state it shows. */
function PinToggle({ row }: { row: NoteRow }) {
    const { pin } = useNoteMutations()
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={row.pinned}
            aria-label={row.pinned ? `Unpin ${row.title}` : `Pin ${row.title}`}
            title={row.pinned ? "Unpin" : "Pin to the top"}
            disabled={pin.isPending}
            onClick={(e) => { e.stopPropagation(); pin.mutate({ id: row.id, pinned: !row.pinned }) }}
            className="h-8 w-8 cursor-pointer rounded-full"
        >
            {pin.isPending ? <InlineLoader size={14} label="Saving" />
                : <Pin className={cn("h-4 w-4", row.pinned ? "fill-current text-neutral-900 dark:text-white" : "text-neutral-400")} />}
        </Button>
    )
}

/**
 * The pinned-end action column. Clicks stop here so they never also open the row (React events from the popovers'
 * portals bubble through this wrapper too). Each row owns its mutations, so one row's spinner is that row's.
 */
function RowActions({ row, onOpen }: { row: NoteRow; onOpen: (row: NoteRow) => void }) {
    const { archive, remove } = useNoteMutations()
    return (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button type="button" variant="ghost" size="icon" data-sheet-keep-open="" aria-label={`Open ${row.title}`} title="Open" onClick={() => onOpen(row)} className="h-8 w-8 cursor-pointer rounded-full">
                <PanelRightOpen className="h-4 w-4" />
            </Button>
            {row.archivedAt ? (
                <Button type="button" variant="ghost" size="icon" aria-label={`Move ${row.title} back to Active`} title="Move to Active" disabled={archive.isPending}
                    onClick={() => archive.mutate({ id: row.id, archived: false })} className="h-8 w-8 cursor-pointer rounded-full">
                    {archive.isPending ? <InlineLoader size={14} label="Restoring" /> : <ArchiveRestore className="h-4 w-4" />}
                </Button>
            ) : (
                <ConfirmPopover title="Archive this note?" description="It moves to the Archived tab. You can bring it back." confirmLabel="Archive" destructive={false}
                    onConfirm={async () => { await archive.mutateAsync({ id: row.id, archived: true }) }}>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Archive ${row.title}`} title="Archive" className="h-8 w-8 cursor-pointer rounded-full">
                        <Archive className="h-4 w-4" />
                    </Button>
                </ConfirmPopover>
            )}
            <ConfirmPopover title="Delete this note?" description="It is removed for good. Archive it instead to keep it." confirmLabel="Delete"
                onConfirm={async () => { await remove.mutateAsync(row.id) }}>
                <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${row.title}`} title="Delete" className="h-8 w-8 cursor-pointer rounded-full">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </ConfirmPopover>
        </div>
    )
}
