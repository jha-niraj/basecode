"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Database, RefreshCw, Save, Settings, SlidersHorizontal } from "lucide-react"
import { Button } from "@repo/ui/components/ui/button"
import { ConfirmPopover } from "@repo/ui/components/ui/confirm-popover"
import { InlineLoader } from "@repo/ui/components/ui/inline-loader"
import { Input } from "@repo/ui/components/ui/input"
import { Label } from "@repo/ui/components/ui/label"
import { Page } from "@repo/ui/components/ui/page"
import { SectionPanel } from "@repo/ui/components/ui/section-panel"
import { StatBand } from "@repo/ui/components/ui/stat-band"
import { Switch } from "@repo/ui/components/ui/switch"
import { toast } from "@repo/ui/components/ui/toast"
import { clearCache, getSystemHealth, getSystemSettings, updateSystemSetting, type SystemHealth } from "@/actions/system.action"
import { useAdminAccess } from "@/context/admin-access-context"
import { fmtNumber } from "@/components/admin-format"

export interface SettingsData {
    values: Record<string, string>
    updatedAt: Record<string, string>
    health: SystemHealth | null
}

type SettingDef = {
    key: string
    label: string
    description: string
    defaultValue: string
    type: "text" | "email" | "number" | "toggle"
}

/** The settings this base reads. A product adds its own here; each is one row in admin_system_settings. */
const SETTINGS: SettingDef[] = [
    { key: "platform_name", label: "Platform name", description: "Shown to people in emails and pages that read this setting", defaultValue: "", type: "text" },
    { key: "support_email", label: "Support email", description: "Where people are told to write for help", defaultValue: "", type: "email" },
    { key: "max_users", label: "User limit", description: "The most accounts the platform accepts (blank = no limit)", defaultValue: "", type: "number" },
    { key: "maintenance_mode", label: "Maintenance mode", description: "Show a maintenance notice instead of the app", defaultValue: "false", type: "toggle" },
    { key: "registration_enabled", label: "Sign-ups open", description: "Let new people create an account", defaultValue: "true", type: "toggle" },
    { key: "email_verification_required", label: "Email verification required", description: "People confirm their email before they can use the app", defaultValue: "true", type: "toggle" },
]

const KEY = ["system", "settings"] as const

async function load(): Promise<SettingsData> {
    const [s, h] = await Promise.all([getSystemSettings(), getSystemHealth()])
    if (!s.success) throw new Error(s.error ?? "Could not load the settings")
    return {
        values: Object.fromEntries((s.data ?? []).map((x) => [x.key, x.value == null ? "" : String(x.value)])),
        updatedAt: Object.fromEntries((s.data ?? []).map((x) => [x.key, new Date(x.updatedAt).toISOString()])),
        health: h.success ? h.data ?? null : null,
    }
}

export function SettingsClient({ initial }: { initial: SettingsData }) {
    const queryClient = useQueryClient()
    const { can } = useAdminAccess()
    const canWrite = can("system", "write")
    const { data } = useQuery({ queryKey: KEY, initialData: initial, queryFn: load })

    const saved = React.useCallback((key: string) => data.values[key] ?? SETTINGS.find((s) => s.key === key)?.defaultValue ?? "", [data.values])
    const [draft, setDraft] = React.useState<Record<string, string>>({})
    const [dirty, setDirty] = React.useState(false)
    // Fresh server values replace the draft only while nothing is being edited.
    React.useEffect(() => { if (!dirty) setDraft({}) }, [data, dirty])
    const value = (key: string) => draft[key] ?? saved(key)
    const set = (key: string, v: string) => { setDraft((d) => ({ ...d, [key]: v })); setDirty(true) }
    const changed = SETTINGS.filter((s) => draft[s.key] !== undefined && draft[s.key] !== saved(s.key))

    const save = useMutation({
        mutationFn: async () => {
            for (const s of changed) {
                const v = value(s.key)
                if (s.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error(`${s.label}: that is not an email address`)
                if (s.type === "number" && v && !/^\d+$/.test(v)) throw new Error(`${s.label}: use a whole number`)
            }
            for (const s of changed) {
                const res = await updateSystemSetting(s.key, { value: value(s.key), description: s.description })
                if (!res.success) throw new Error(res.error ?? `Could not save ${s.label}`)
            }
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: KEY })
            setDirty(false)
            toast.success(changed.length === 1 ? "Setting saved" : "Settings saved")
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save"),
    })

    const health = data.health
    const savedCount = Object.keys(data.values).length

    return (
        <Page
            title="Settings"
            icon={<Settings />}
            description="Platform configuration and health"
            extra={canWrite ? (
                <ConfirmPopover
                    title="Clear the page cache?"
                    description="Every console page is rebuilt on its next visit. Nothing is deleted."
                    confirmLabel="Clear cache"
                    destructive={false}
                    onConfirm={async () => {
                        const res = await clearCache()
                        if (!res.success) { toast.error(res.error ?? "Could not clear the cache"); throw new Error("failed") }
                        toast.success("Cache cleared")
                    }}
                >
                    <Button variant="outline" className="cursor-pointer gap-2"><RefreshCw className="h-4 w-4" /><span className="hidden sm:inline">Clear cache</span></Button>
                </ConfirmPopover>
            ) : undefined}
        >
            <StatBand
                items={[
                    {
                        icon: Database,
                        label: "Database",
                        value: health ? (health.databaseStatus === "healthy" ? "Healthy" : "Not reachable") : "Not checked",
                        tone: health?.databaseStatus === "unhealthy" ? "rose" : undefined,
                    },
                    {
                        icon: AlertTriangle,
                        label: "Errors logged",
                        value: health ? fmtNumber(health.recentErrors) : "-",
                        hint: "all time, audit log",
                        tone: health && health.recentErrors > 0 ? "amber" : undefined,
                    },
                    { icon: SlidersHorizontal, label: "Settings saved", value: fmtNumber(savedCount), hint: `of ${SETTINGS.length}` },
                ]}
            />
            <form
                onSubmit={(e) => { e.preventDefault(); if (changed.length > 0 && !save.isPending) save.mutate() }}
                className="flex min-w-0 flex-col gap-3"
            >
                <SectionPanel
                    title="Platform"
                    description={canWrite ? "Changes apply once saved" : "You can read these settings; changing them needs the system write permission"}
                    action={canWrite ? (
                        <Button type="submit" size="sm" className="cursor-pointer gap-2" disabled={changed.length === 0 || save.isPending}>
                            {save.isPending ? <InlineLoader size={14} label="Saving" /> : <Save className="h-4 w-4" />}
                            {changed.length > 1 ? `Save ${changed.length} changes` : "Save"}
                        </Button>
                    ) : undefined}
                >
                    <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {SETTINGS.map((s) => (
                            <div key={s.key} className="flex min-w-0 flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-6">
                                <div className="min-w-0 flex-1">
                                    <Label htmlFor={`setting-${s.key}`} className="text-sm font-medium text-neutral-900 dark:text-white">{s.label}</Label>
                                    <p className="text-xs text-neutral-600 dark:text-neutral-400">{s.description}</p>
                                </div>
                                <div className="flex shrink-0 items-center sm:w-64 sm:justify-end">
                                    {s.type === "toggle" ? (
                                        <Switch
                                            id={`setting-${s.key}`}
                                            className="cursor-pointer"
                                            checked={value(s.key) === "true"}
                                            onCheckedChange={(on) => set(s.key, on ? "true" : "false")}
                                            disabled={!canWrite}
                                        />
                                    ) : (
                                        <Input
                                            id={`setting-${s.key}`}
                                            type={s.type === "number" ? "text" : s.type}
                                            inputMode={s.type === "number" ? "numeric" : undefined}
                                            value={value(s.key)}
                                            onChange={(e) => set(s.key, e.target.value)}
                                            placeholder={s.type === "number" ? "No limit" : "Not set"}
                                            disabled={!canWrite}
                                            className="w-full"
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </SectionPanel>
            </form>
        </Page>
    )
}
