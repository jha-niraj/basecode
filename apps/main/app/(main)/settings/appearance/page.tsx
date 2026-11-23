import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getShellPrefs } from "@/lib/settings"
import { ROUTES } from "@/lib/navigation"
import { AppearanceView } from "./appearance-view"

export const metadata: Metadata = { title: "Appearance" }

export default async function AppearancePage() {
    const session = await getSession()
    if (!session) redirect(`${ROUTES.signIn}?stale=1&returnTo=${ROUTES.settingsAppearance}`)
    // The layout already read these this request (React cache) - no second round trip.
    const { appearance } = await getShellPrefs(session.user.id)
    return <AppearanceView initial={appearance} />
}
