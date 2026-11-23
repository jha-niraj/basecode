import type { Metadata } from "next"
import { getAdminUsers } from "@/actions/admin.action"
import { requireAdminPage } from "@/lib/admin-session"
import { AccessClient } from "./_components/access-client"

export const metadata: Metadata = { title: "Access" }

export default async function AccessPage() {
    await requireAdminPage("admin_management")
    const team = await getAdminUsers()
    return <AccessClient initialTeam={team.success ? (team.data ?? []) : undefined} />
}
