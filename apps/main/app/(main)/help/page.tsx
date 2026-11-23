import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isEmailConfigured } from "@repo/email"
import { getSession } from "@/lib/session"
import { ROUTES } from "@/lib/navigation"
import { HelpView } from "./help-view"

export const metadata: Metadata = { title: "Help" }

export default async function HelpPage() {
    const session = await getSession()
    if (!session) redirect(`${ROUTES.signIn}?stale=1&returnTo=${ROUTES.help}`)
    const contact = !process.env.SUPPORT_EMAIL?.trim()
        ? "no-support-email"
        : !isEmailConfigured() ? "no-email-provider" : "ready"
    return <HelpView contact={contact} />
}
