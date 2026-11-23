import type { Metadata } from "next"
import { getSystemHealth, getSystemSettings } from "@/actions/system.action"
import { requireAdminPage } from "@/lib/admin-session"
import { SettingsClient, type SettingsData } from "./_components/settings-client"

export const metadata: Metadata = { title: "Settings" }

export default async function SystemSettingsPage() {
    await requireAdminPage("system")
    const [settings, health] = await Promise.all([getSystemSettings(), getSystemHealth()])
    if (!settings.success) throw new Error(settings.error ?? "Could not load the settings")
    const initial: SettingsData = {
        values: Object.fromEntries((settings.data ?? []).map((s) => [s.key, s.value == null ? "" : String(s.value)])),
        updatedAt: Object.fromEntries((settings.data ?? []).map((s) => [s.key, s.updatedAt.toISOString()])),
        health: health.success ? health.data ?? null : null,
    }
    return <SettingsClient initial={initial} />
}
