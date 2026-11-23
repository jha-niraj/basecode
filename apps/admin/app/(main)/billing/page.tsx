import type { Metadata } from "next"
import { getBillingPayments, getBillingStats, getBillingSubscriptions } from "@/actions/billing.action"
import { requireAdminPage } from "@/lib/admin-session"
import { BillingClient } from "./_components/billing-client"

export const metadata: Metadata = { title: "Billing" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** Payments, subscriptions and credit grants. Reading needs `analytics`; granting needs `users` write. */
export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
    await requireAdminPage("analytics")
    const sp = await searchParams
    const tab = sp.tab === "subscriptions" ? "subscriptions" : "payments"
    const [stats, payments, subs] = await Promise.all([getBillingStats(), getBillingPayments({}, 1), getBillingSubscriptions(1)])
    return (
        <BillingClient
            initialTab={tab}
            initialStats={stats.success ? stats.data : undefined}
            initialPayments={payments.success ? payments.data : undefined}
            initialSubscriptions={subs.success ? subs.data : undefined}
        />
    )
}
