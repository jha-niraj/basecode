import type { FilterGroupNode, FilterNode, FilterQuery, FilterRule } from "../components/reui/filters/filters-types"

/**
 * Apply a ReUI `Filters` query to rows already in the browser (a list the page loaded whole). For a list filtered on
 * the server, send the query (or `flattenFilterRules(query)`) to the Server Action instead and filter in SQL.
 *
 *   const shown = rows.filter((r) => matchesFilterQuery(query, (field) => r[field as keyof Row]))
 *
 * `read(fieldId)` returns the row's value for a field (the rule's `path[0]`; a nested path is joined with "."). Values
 * compare as strings, case-insensitively for text operators. Supported: text (contains / starts_with / ends_with / is /
 * empty), select and multiselect (is / is_any_of / has_any_of / has_all_of / their inverses), boolean (is), number
 * (eq / gt / gte / lt / lte / between). An unknown operator or an incomplete rule matches everything (a half-built chip
 * must not empty the list).
 */
export type FilterRead = (fieldId: string) => unknown

const str = (v: unknown) => (v == null ? "" : String(v))
const lower = (v: unknown) => str(v).toLowerCase()
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.map(str) : v == null || v === "" ? [] : [str(v)])
const num = (v: unknown): number | null => {
    if (v == null || v === "") return null
    const n = typeof v === "number" ? v : Number(v)
    return Number.isFinite(n) ? n : null
}

function matchRule(rule: FilterRule, read: FilterRead): boolean {
    const field = rule.path.join(".")
    const actual = read(field)
    const want = rule.value
    let hit: boolean
    switch (rule.operator) {
        case "empty": hit = asList(actual).length === 0; break
        case "not_empty": hit = asList(actual).length > 0; break
        case "contains": if (want == null || want === "") return true; hit = lower(actual).includes(lower(want)); break
        case "not_contains": if (want == null || want === "") return true; hit = !lower(actual).includes(lower(want)); break
        case "starts_with": if (want == null || want === "") return true; hit = lower(actual).startsWith(lower(want)); break
        case "ends_with": if (want == null || want === "") return true; hit = lower(actual).endsWith(lower(want)); break
        case "is": if (want === undefined) return true; hit = asList(actual).some((a) => a.toLowerCase() === lower(want)); break
        case "is_not": if (want === undefined) return true; hit = !asList(actual).some((a) => a.toLowerCase() === lower(want)); break
        case "is_any_of":
        case "has_any_of": {
            const w = asList(want); if (w.length === 0) return true
            const a = asList(actual); hit = w.some((x) => a.includes(x)); break
        }
        case "is_none_of":
        case "has_none_of": {
            const w = asList(want); if (w.length === 0) return true
            const a = asList(actual); hit = !w.some((x) => a.includes(x)); break
        }
        case "has_all_of": {
            const w = asList(want); if (w.length === 0) return true
            const a = asList(actual); hit = w.every((x) => a.includes(x)); break
        }
        case "eq": case "neq": case "gt": case "gte": case "lt": case "lte": {
            const a = num(actual); const w = num(want)
            if (w == null) return true
            if (a == null) { hit = rule.operator === "neq"; break }
            hit = rule.operator === "eq" ? a === w : rule.operator === "neq" ? a !== w
                : rule.operator === "gt" ? a > w : rule.operator === "gte" ? a >= w
                : rule.operator === "lt" ? a < w : a <= w
            break
        }
        case "between": case "not_between": {
            const [lo, hi] = Array.isArray(want) ? want.map(num) : [null, null]
            const a = num(actual)
            if (lo == null && hi == null) return true
            const inside = a != null && (lo == null || a >= lo) && (hi == null || a <= hi)
            hit = rule.operator === "between" ? inside : !inside
            break
        }
        default: return true
    }
    return rule.negated ? !hit : hit
}

function matchNode(node: FilterNode, read: FilterRead): boolean {
    if (node.type === "rule") return matchRule(node, read)
    return matchGroup(node, read)
}

function matchGroup(group: FilterGroupNode, read: FilterRead): boolean {
    if (group.rules.length === 0) return true
    return group.combinator === "or"
        ? group.rules.some((n) => matchNode(n, read))
        : group.rules.every((n) => matchNode(n, read))
}

export function matchesFilterQuery(query: FilterQuery | null | undefined, read: FilterRead): boolean {
    if (!query) return true
    return matchGroup(query, read)
}
