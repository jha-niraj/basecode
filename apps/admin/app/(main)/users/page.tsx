import type { Metadata } from "next"
import { getUsers, getUserStats } from "@/actions/user.action"
import { requireAdminPage } from "@/lib/admin-session"
import { UsersClient } from "./_components/users-client"
import { USERS_PAGE_SIZE } from "./_components/users-query"

export const metadata: Metadata = { title: "Users" }

export default async function UsersPage() {
    await requireAdminPage("users")
    const [list, stats] = await Promise.all([getUsers(1, USERS_PAGE_SIZE), getUserStats()])
    return (
        <UsersClient
            initialList={list.success ? list.data : undefined}
            initialStats={stats.success ? stats.data : undefined}
        />
    )
}
