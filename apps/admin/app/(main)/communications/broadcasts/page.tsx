import type { Metadata } from "next"
import { getBroadcasts } from "@/actions/broadcasts.action"
import { requireAdminPage } from "@/lib/admin-session"
import { BroadcastsClient } from "./_components/broadcasts-client"

export const metadata: Metadata = { title: "Broadcasts" }

export default async function BroadcastsPage({ searchParams }: { searchParams: Promise<{ tab?: string; open?: string }> }) {
    await requireAdminPage("communications")
    const [params, res] = await Promise.all([searchParams, getBroadcasts()])
    if (!res.success) throw new Error(res.error)
    return <BroadcastsClient initial={res.data} initialTab={params.tab} initialOpen={params.open ?? null} />
}
