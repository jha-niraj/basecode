/** The /notifications URL state (`?tab=unread&page=2`), parsed the same way on the server and in the browser. */
export interface NotificationParams {
    filter: "all" | "unread"
    page: number
}

export function parseNotificationParams(sp: Record<string, string | string[] | undefined> | URLSearchParams): NotificationParams {
    const get = (k: string) => {
        if (sp instanceof URLSearchParams) return sp.get(k) ?? undefined
        const v = sp[k]
        return Array.isArray(v) ? v[0] : v
    }
    const page = Number.parseInt(get("page") ?? "1", 10)
    return { filter: get("tab") === "unread" ? "unread" : "all", page: Number.isFinite(page) && page > 0 ? page : 1 }
}

export function notificationsKey(p: NotificationParams) {
    return ["notifications", "page", p.filter, p.page] as const
}
