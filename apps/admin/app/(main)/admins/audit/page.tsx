import type { Metadata } from "next"
import { getAdminList, getAuditLogsFiltered } from "@/actions/admin.action"
import { requireAdminPage } from "@/lib/admin-session"
import { AuditLogsClient } from "./_components/audit-logs-client"
import { AUDIT_LIMIT, auditWindowFrom, parseAuditWindow } from "./_components/audit-window"

export const metadata: Metadata = { title: "Audit log" }

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ window?: string; admin?: string; open?: string }> }) {
    await requireAdminPage("admin_management")
    const params = await searchParams
    const window = parseAuditWindow(params.window)
    const [logs, admins] = await Promise.all([
        getAuditLogsFiltered({ from: auditWindowFrom(window), limit: AUDIT_LIMIT }),
        getAdminList(),
    ])
    if (!logs.success || !logs.data) throw new Error(logs.error ?? "Could not load the audit log")
    return (
        <AuditLogsClient
            initialWindow={window}
            initialLogs={logs.data}
            admins={admins.success ? admins.data ?? [] : []}
            initialAdminFilter={params.admin ?? null}
        />
    )
}
