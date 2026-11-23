import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { listNotifications } from "@/actions/notification.action"
import { getSession } from "@/lib/session"
import { ROUTES } from "@/lib/navigation"
import { NotificationsView } from "./notifications-view"
import { parseNotificationParams } from "./params"

export const metadata: Metadata = { title: "Notifications" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** The first page is read here and seeds the client query under the same key; tabs and pages refetch from there. */
export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
    const session = await getSession()
    if (!session) redirect(`${ROUTES.signIn}?stale=1&returnTo=${ROUTES.notifications}`)
    const params = parseNotificationParams(await searchParams)
    const res = await listNotifications(params)
    return <NotificationsView initialParams={params} initialData={res.success ? res.data : null} initialError={res.success ? null : (res.error ?? "Could not load notifications.")} />
}
