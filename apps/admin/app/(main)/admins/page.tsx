import type { Metadata } from "next"
import { getAdminUsers, getPendingInvitations } from "@/actions/admin.action"
import { requireAdminPage } from "@/lib/admin-session"
import { TeamClient } from "./_components/team-client"

export const metadata: Metadata = { title: "Admins" }

export default async function AdminsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
    await requireAdminPage("admin_management")
    const [team, invites, sp] = await Promise.all([getAdminUsers(), getPendingInvitations(), searchParams])
    return (
        <TeamClient
            initialTeam={team.success ? (team.data ?? []) : undefined}
            initialInvitations={invites.success ? (invites.data ?? []) : undefined}
            initialTab={sp.tab}
        />
    )
}
