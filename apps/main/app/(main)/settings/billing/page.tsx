import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { billingOverview } from "@repo/billing"
import { getSession } from "@/lib/session"
import { BillingView } from "./_components/billing-view"

export const metadata: Metadata = { title: "Billing" }

/**
 * Billing: the plan, its period, credits and payments. The page checks the session itself and reads the overview on
 * the server (one parallel round); the client keeps it under ["billing", "overview"] and refetches after a change.
 * The first visit creates the person's billing account (with the Free plan's starter credits) - one idempotent insert.
 */
export default async function BillingPage() {
    const session = await getSession()
    if (!session) redirect("/signin?stale=1&returnTo=/settings/billing")
    const overview = await billingOverview(session.user.id)
    return <BillingView initial={overview} />
}
