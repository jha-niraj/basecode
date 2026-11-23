import type { Metadata } from "next"
import { getAdminActivityReport } from "@/actions/analytics.action"
import { requireAdminPage } from "@/lib/admin-session"
import { ActivityClient } from "./_components/activity-client"

export const metadata: Metadata = { title: "Admin activity" }

export default async function AdminActivityPage() {
    await requireAdminPage("analytics")
    const res = await getAdminActivityReport()
    if (!res.success || !res.data) throw new Error(res.error ?? "Could not load the activity report")
    return <ActivityClient initial={res.data} />
}
