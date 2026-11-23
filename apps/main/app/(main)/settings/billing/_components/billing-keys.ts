/** Query keys and small display helpers for the billing screens (client-safe). */
export const BILLING_KEYS = {
    all: ["billing"] as const,
    overview: ["billing", "overview"] as const,
    payment: (id: string) => ["billing", "payment", id] as const,
}

/** "23 Nov 2026" in UTC - periods are stored as UTC instants. */
export function formatBillingDate(iso: string | null | undefined): string {
    if (!iso) return "-"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "-"
    return d.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

export const PROVIDER_NAMES: Record<string, string> = {
    esewa: "eSewa",
    khalti: "Khalti",
    razorpay: "Razorpay",
    cashfree: "Cashfree",
    stripe: "Card",
}

export const STATUS_LABELS: Record<string, string> = {
    created: "Started",
    pending: "Waiting",
    succeeded: "Paid",
    failed: "Failed",
    cancelled: "Cancelled",
    refunded: "Refunded",
}
