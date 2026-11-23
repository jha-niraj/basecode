// A PLAIN module (no "use client"): the server page reads the URL with the same parser the client writes it with, so
// the server's `initialData` lands under exactly the key the client asks for. Filters are imported from the plain
// filters modules, not filters.tsx ("use client"), for the same reason.
import { createFilterQuery, createFilterRule, flattenFilterRules } from "@repo/ui/components/reui/filters/filters-query"
import type { FilterField, FilterQuery, FilterRule } from "@repo/ui/components/reui/filters/filters-types"
import { NOTE_TAG_MAX, NOTE_TAGS_MAX } from "@/schemas/notes"
import type { NoteListParams, NotePinnedFilter, NoteTab } from "@/types/notes"

/**
 * Query keys: `["<module>", "<name>", ...params]`. Every mutation invalidates `NOTE_KEYS.all`, which covers the list
 * (every page and filter), the band and each open note - never a hand-spliced cache entry.
 */
export const NOTE_KEYS = {
    all: ["notes"] as const,
    list: (params: NoteListParams) => ["notes", "list", params] as const,
    stats: ["notes", "stats"] as const,
    detail: (id: string) => ["notes", "detail", id] as const,
}

export const NOTE_TABS: { value: NoteTab; label: string }[] = [
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
]

export const DEFAULT_NOTE_PARAMS: NoteListParams = { tab: "active", q: "", tags: [], pinned: null, page: 1 }

type SearchParamsLike = Record<string, string | string[] | undefined> | URLSearchParams

function read(sp: SearchParamsLike, key: string): string | undefined {
    if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined
    const v = sp[key]
    return Array.isArray(v) ? v[0] : v
}

/** Sorted and de-duplicated, so `?tag=b,a` and `?tag=a,b` are one cache entry. */
const normTags = (list: string[]) =>
    [...new Set(list.map((t) => t.trim().toLowerCase()).filter((t) => t && t.length <= NOTE_TAG_MAX))].sort().slice(0, NOTE_TAGS_MAX)

/**
 * The URL -> the list's params. A value that makes no sense (a stale or hand-edited link) falls back to the default
 * instead of an error or an empty page.
 */
export function parseNoteParams(sp: SearchParamsLike): NoteListParams {
    const tab = read(sp, "tab") === "archived" ? "archived" : "active"
    const q = (read(sp, "q") ?? "").trim().slice(0, 200)
    const tags = normTags((read(sp, "tag") ?? "").split(","))
    const rawPinned = read(sp, "pinned")
    const pinned: NotePinnedFilter | null = rawPinned === "yes" || rawPinned === "no" ? rawPinned : null
    const page = Math.min(10_000, Math.max(1, Number.parseInt(read(sp, "page") ?? "1", 10) || 1))
    return { tab, q, tags, pinned, page }
}

/** `?open=` - a note id, or "new" for the create sheet. Home and the AI page link here. */
export function parseOpenParam(sp: SearchParamsLike): string | null {
    const v = read(sp, "open")?.trim()
    return v ? v.slice(0, 64) : null
}

/** The params -> the URL. Defaults are left out, so the plain `/notes` IS the default view. */
export function noteParamsToSearch(p: NoteListParams, open?: string | null): string {
    const out = new URLSearchParams()
    if (p.tab !== "active") out.set("tab", p.tab)
    if (p.q) out.set("q", p.q)
    if (p.tags.length > 0) out.set("tag", p.tags.join(","))
    if (p.pinned) out.set("pinned", p.pinned)
    if (p.page > 1) out.set("page", String(p.page))
    if (open) out.set("open", open)
    return out.toString()
}

export const sameNoteParams = (a: NoteListParams, b: NoteListParams) => noteParamsToSearch(a) === noteParamsToSearch(b)

/* ---------- ReUI Filters <-> params ----------
 * The chips are UI; the params are the truth the server filters on. Each field offers ONE operator, so a chip always
 * means exactly one SQL condition (no "is none of" the server would have to second-guess). Rule ids are fixed, so a
 * query rebuilt from the URL is stable across renders and hydration. */

const PINNED_OPTIONS = [
    { value: "yes", label: "Pinned" },
    { value: "no", label: "Not pinned" },
]

export function noteFilterFields(tags: string[]): FilterField[] {
    return [
        {
            id: "tag",
            label: "Tag",
            type: "multiselect",
            options: tags.map((t) => ({ value: t, label: t })),
            operators: [{ value: "has_any_of", label: "has any of", arity: "many" }],
            defaultOperator: "has_any_of",
            placeholder: "Find a tag",
        },
        {
            id: "pinned",
            label: "Pinned",
            type: "select",
            options: PINNED_OPTIONS,
            operators: [{ value: "is", label: "is", arity: "one" }],
            defaultOperator: "is",
            searchable: false,
        },
    ]
}

export function noteFilterQuery(p: NoteListParams): FilterQuery {
    const rules: FilterRule[] = []
    if (p.tags.length > 0) rules.push(createFilterRule({ id: "tag", path: ["tag"], operator: "has_any_of", value: p.tags }))
    if (p.pinned) rules.push(createFilterRule({ id: "pinned", path: ["pinned"], operator: "is", value: p.pinned }))
    return createFilterQuery(rules)
}

/** What the chips filter on. A half-built chip (no value yet) filters nothing, so the list does not empty mid-edit. */
export function noteFiltersFromQuery(query: FilterQuery): Pick<NoteListParams, "tags" | "pinned"> {
    const tags: string[] = []
    let pinned: NotePinnedFilter | null = null
    for (const rule of flattenFilterRules(query)) {
        const field = rule.path[0]
        if (field === "tag" && Array.isArray(rule.value)) tags.push(...rule.value.map(String))
        if (field === "pinned" && (rule.value === "yes" || rule.value === "no")) pinned = rule.value
    }
    return { tags: normTags(tags), pinned }
}

/** The PDF of the view on screen: the same filters, every page. */
export function notesPdfHref(p: NoteListParams): string {
    const qs = noteParamsToSearch({ ...p, page: 1 })
    return `/api/documents/notes.pdf${qs ? `?${qs}` : ""}`
}
