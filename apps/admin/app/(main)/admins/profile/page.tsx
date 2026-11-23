import type { Metadata } from "next"
import { getCurrentAdmin } from "@/actions/admin.action"
import { requireAdminPage } from "@/lib/admin-session"
import { ProfileClient, type ProfileData } from "./_components/profile-client"

export const metadata: Metadata = { title: "Profile" }

export default async function AdminProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
    const admin = await requireAdminPage()
    const [res, sp] = await Promise.all([getCurrentAdmin(), searchParams])
    const record = res.success ? res.data : undefined
    const profile: ProfileData = {
        userId: admin.userId,
        name: admin.name,
        email: admin.email,
        image: admin.image,
        role: admin.role,
        status: admin.status,
        permissions: admin.permissions,
        createdAt: record?.createdAt ? record.createdAt.toISOString() : null,
        lastLoginAt: record?.lastLoginAt ? record.lastLoginAt.toISOString() : null,
    }
    return <ProfileClient profile={profile} initialTab={sp.tab} />
}
