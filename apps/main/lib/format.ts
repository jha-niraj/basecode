/** Display helpers safe in the browser and on the server. */

/**
 * Integer micro-USD (ai_usage_log.cost_micro_usd) as dollars. Small amounts keep enough digits to be non-zero:
 * $0.0042 rather than $0.00 - a real cost that rounds to zero reads as free.
 */
export function formatMicroUsd(micro: number): string {
    const usd = micro / 1_000_000
    if (micro === 0) return "$0.00"
    if (Math.abs(usd) < 0.01) return `$${usd.toFixed(4)}`
    if (Math.abs(usd) < 100) return `$${usd.toFixed(2)}`
    return `$${Math.round(usd).toLocaleString("en-US")}`
}

export function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    if (n >= 10_000) return `${Math.round(n / 1000)}k`
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
    return n.toLocaleString("en-US")
}

/** "Nov 23" for a UTC day key `YYYY-MM-DD`. */
export function shortDay(dayKey: string): string {
    const d = new Date(`${dayKey}T00:00:00Z`)
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

/** The UTC day keys from `days - 1` days ago to today, oldest first. */
export function lastUtcDays(days: number, now: Date = new Date()): string[] {
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    return Array.from({ length: days }, (_, i) => new Date(start - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10))
}
