import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getAiUsage } from "@/lib/usage"
import { ROUTES } from "@/lib/navigation"
import { UsageView } from "./usage-view"

export const metadata: Metadata = { title: "AI usage" }

export default async function UsagePage() {
    const session = await getSession()
    if (!session) redirect(`${ROUTES.signIn}?stale=1&returnTo=${ROUTES.settingsUsage}`)
    const usage = await getAiUsage(session.user.id)
    return <UsageView initialData={usage} />
}
