"use client"

import * as React from "react"
import { RotateCcw } from "lucide-react"
import { Page } from "@repo/ui/components/ui/page"
import { Switch } from "@repo/ui/components/ui/switch"
import { toast } from "@repo/ui/components/ui/toast"
import { resetNotificationPreferences, saveNotificationPreference } from "@/actions/settings.action"
import { NOTIFICATION_TOPICS, type NotificationPreferenceView } from "@/lib/settings-values"
import { Section } from "../../profile/_components/section"

/**
 * Per-topic email / in-app switches. Each switch saves on its own (no Save button for a row of toggles): it flips at
 * once and flips back with a toast if the save fails.
 */
export function NotificationPreferencesView({ initial }: { initial: NotificationPreferenceView[] }) {
    const [prefs, setPrefs] = React.useState(initial)
    const [resetting, setResetting] = React.useState(false)
    const allDefault = prefs.every((p) => p.email && p.inApp)

    async function toggle(topic: NotificationPreferenceView["topic"], channel: "email" | "inApp", enabled: boolean) {
        const before = prefs
        setPrefs((list) => list.map((p) => (p.topic === topic ? { ...p, [channel]: enabled } : p)))
        const res = await saveNotificationPreference({ topic, channel, enabled })
        if (!res.success) {
            setPrefs(before)
            toast.error(res.error ?? "Could not save that.")
            return
        }
        toast.success("Saved")
    }

    async function reset() {
        setResetting(true)
        const res = await resetNotificationPreferences()
        setResetting(false)
        if (!res.success) return void toast.error(res.error ?? "Could not reset.")
        setPrefs((list) => list.map((p) => ({ ...p, email: true, inApp: true })))
        toast.success("Back to the defaults")
    }

    return (
        <Page
            width="reading"
            title="Notifications"
            description="Choose what reaches your inbox and what shows in the app."
            actions={[{
                key: "reset",
                label: "Reset to defaults",
                icon: <RotateCcw className="h-3.5 w-3.5" />,
                variant: "outline",
                onClick: () => void reset(),
                pending: resetting,
                disabled: allDefault,
            }]}
        >
            <div className="flex w-full flex-col gap-3">
                <Section title="What you hear about" description="In-app notifications show under the bell. Turning one off stops new ones; past ones stay.">
                    <div className="mb-1 hidden justify-end gap-6 pr-0.5 text-xs text-neutral-600 sm:flex dark:text-neutral-400">
                        <span className="w-9 text-center">Email</span>
                        <span className="w-9 text-center">In app</span>
                    </div>
                    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {NOTIFICATION_TOPICS.map((t) => {
                            const p = prefs.find((x) => x.topic === t.key) ?? { topic: t.key, email: true, inApp: true }
                            const locked = "emailLocked" in t && t.emailLocked
                            return (
                                <li key={t.key} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-neutral-900 dark:text-white">{t.label}</p>
                                        <p className="text-xs text-neutral-600 dark:text-neutral-400">
                                            {t.description}{locked ? " Security emails are always sent." : ""}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-6">
                                        <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600 sm:block dark:text-neutral-400">
                                            <span className="sm:sr-only">Email</span>
                                            <Switch
                                                checked={p.email}
                                                disabled={locked}
                                                aria-label={`${t.label} by email`}
                                                onCheckedChange={(v) => void toggle(t.key, "email", v)}
                                            />
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600 sm:block dark:text-neutral-400">
                                            <span className="sm:sr-only">In app</span>
                                            <Switch
                                                checked={p.inApp}
                                                aria-label={`${t.label} in the app`}
                                                onCheckedChange={(v) => void toggle(t.key, "inApp", v)}
                                            />
                                        </label>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                </Section>
            </div>
        </Page>
    )
}
