import type { Metadata } from "next"
import { getPlatformAnnouncements } from "@/actions/announcements.action"
import { requireAdminPage } from "@/lib/admin-session"
import { AnnouncementsClient } from "./_components/announcements-client"

export const metadata: Metadata = { title: "Announcements" }

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ tab?: string; open?: string }> }) {
    await requireAdminPage("communications")
    const [params, res] = await Promise.all([searchParams, getPlatformAnnouncements()])
    if (!res.success) throw new Error(res.error)
    return <AnnouncementsClient initial={res.data} initialTab={params.tab} initialOpen={params.open ?? null} />
}
