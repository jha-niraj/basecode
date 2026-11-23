import type { Metadata } from "next"
import { getCommunicationsOverview } from "@/actions/communications.action"
import { requireAdminPage } from "@/lib/admin-session"
import { OverviewClient } from "./_components/overview-client"

export const metadata: Metadata = { title: "Communications" }

export default async function CommunicationsPage() {
    await requireAdminPage("communications")
    const res = await getCommunicationsOverview()
    if (!res.success) throw new Error(res.error)
    return <OverviewClient initial={res.data} />
}
