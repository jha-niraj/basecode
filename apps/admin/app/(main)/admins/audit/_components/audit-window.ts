/** The audit log's time windows. Plain module: the server page and the client both read it. */
export const AUDIT_WINDOWS = [
    { value: "24h", label: "Last 24 hours", hours: 24 },
    { value: "7d", label: "Last 7 days", hours: 24 * 7 },
    { value: "30d", label: "Last 30 days", hours: 24 * 30 },
    { value: "90d", label: "Last 90 days", hours: 24 * 90 },
    { value: "all", label: "All time", hours: null },
] as const

export type AuditWindow = (typeof AUDIT_WINDOWS)[number]["value"]

export const DEFAULT_AUDIT_WINDOW: AuditWindow = "30d"

/** At most this many entries load per window; the count line says when there are more. */
export const AUDIT_LIMIT = 500

export function parseAuditWindow(v: string | string[] | undefined | null): AuditWindow {
    const s = Array.isArray(v) ? v[0] : v
    return AUDIT_WINDOWS.some((w) => w.value === s) ? (s as AuditWindow) : DEFAULT_AUDIT_WINDOW
}

export function auditWindowFrom(w: AuditWindow, now: Date = new Date()): Date | undefined {
    const def = AUDIT_WINDOWS.find((x) => x.value === w)
    return def?.hours == null ? undefined : new Date(now.getTime() - def.hours * 60 * 60 * 1000)
}
