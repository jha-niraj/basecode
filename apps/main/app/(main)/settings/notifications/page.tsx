import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getNotificationPreferences } from "@/lib/settings"
import { ROUTES } from "@/lib/navigation"
import { NotificationPreferencesView } from "./preferences-view"

export const metadata: Metadata = { title: "Notification settings" }

export default async function NotificationSettingsPage() {
    const session = await getSession()
    if (!session) redirect(`${ROUTES.signIn}?stale=1&returnTo=${ROUTES.settingsNotifications}`)
    const prefs = await getNotificationPreferences(session.user.id)
    return <NotificationPreferencesView initial={prefs} />
}
