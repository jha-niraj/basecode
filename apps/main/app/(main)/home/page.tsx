import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { getDashboard } from "@/lib/dashboard"
import { ROUTES } from "@/lib/navigation"
import { HomeView } from "./home-view"

export const metadata: Metadata = { title: "Home" }

export default async function HomePage() {
    const session = await getSession()
    if (!session) redirect(`${ROUTES.signIn}?stale=1&returnTo=${ROUTES.dashboard}`)
    const data = await getDashboard(session.user.id)
    return <HomeView initialData={data} />
}
