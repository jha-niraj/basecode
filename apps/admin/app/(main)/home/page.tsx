import type { Metadata } from "next"
import { getAnalyticsData } from "@/actions/analytics.action"
import { getAuditLogsFiltered } from "@/actions/admin.action"
import { requireAdminPage } from "@/lib/admin-session"
import { adminCan } from "@/lib/permissions"
import { HomeClient, type HomeOverview } from "./_components/home-client"

export const metadata: Metadata = { title: "Home" }

export default async function HomePage() {
    const admin = await requireAdminPage()
    const canAnalytics = adminCan(admin, "analytics")
    const canAudit = adminCan(admin, "admin_management")
    const [analytics, recent] = await Promise.all([
        canAnalytics ? getAnalyticsData() : null,
        canAudit ? getAuditLogsFiltered({ limit: 6 }) : null,
    ])
    const initial: HomeOverview = {
        analytics: analytics?.success ? analytics.data ?? null : null,
        recent: recent?.success ? recent.data?.logs ?? [] : null,
    }
    return <HomeClient initial={initial} canAnalytics={canAnalytics} canAudit={canAudit} firstName={admin.name.split(" ")[0] ?? ""} />
}
