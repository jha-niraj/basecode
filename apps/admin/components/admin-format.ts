/**
 * Display formatting for the console's figures. Fixed locale and UTC so the server render and the first client paint
 * print the same text (no hydration mismatch); `RelativeTime` covers "2h ago".
 */
const NUM = new Intl.NumberFormat("en-US")
const DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" })
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
})
const DAY_SHORT = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" })

export const fmtNumber = (n: number) => NUM.format(n)

export function fmtDate(value: string | Date | null | undefined): string {
    if (!value) return "-"
    const d = typeof value === "string" ? new Date(value) : value
    return Number.isNaN(d.getTime()) ? "-" : DATE.format(d)
}

/** "3 Nov 2026, 14:05 UTC" */
export function fmtDateTime(value: string | Date | null | undefined): string {
    if (!value) return "-"
    const d = typeof value === "string" ? new Date(value) : value
    return Number.isNaN(d.getTime()) ? "-" : `${DATE_TIME.format(d)} UTC`
}

/** A chart label for a YYYY-MM-DD bucket: "3 Nov". */
export function dayLabel(day: string): string {
    const d = new Date(`${day}T00:00:00Z`)
    return Number.isNaN(d.getTime()) ? day : DAY_SHORT.format(d)
}

/** Integer minor units in a currency: 123456 USD -> "USD 1,234.56". */
export function fmtMoneyMinor(minor: number, currency: string): string {
    const code = currency.toUpperCase()
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: code, currencyDisplay: "code" }).format(minor / 100)
    } catch {
        return `${code} ${NUM.format(minor / 100)}`
    }
}

/** Micro-USD (1e-6 USD) as dollars: 1_234_567 -> "$1.23"; under a cent shows "<$0.01". */
export function fmtMicroUsd(micro: number): string {
    if (micro === 0) return "$0.00"
    const usd = micro / 1_000_000
    if (usd < 0.01) return "<$0.01"
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(usd)
}

/** "admin_management" -> "Admin management" */
export function humanize(value: string): string {
    const s = value.replace(/_/g, " ").toLowerCase()
    return s.charAt(0).toUpperCase() + s.slice(1)
}
