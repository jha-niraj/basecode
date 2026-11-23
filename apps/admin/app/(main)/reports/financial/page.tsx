import type { Metadata } from "next"
import { getFinancialReport } from "@/actions/analytics.action"
import { requireAdminPage } from "@/lib/admin-session"
import { FinancialClient } from "./_components/financial-client"

export const metadata: Metadata = { title: "Financial report" }

export default async function FinancialReportPage() {
    await requireAdminPage("analytics")
    const res = await getFinancialReport()
    if (!res.success || !res.data) throw new Error(res.error ?? "Could not load the financial report")
    return <FinancialClient initial={res.data} />
}
