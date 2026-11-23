"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Monitor, Moon, Sun } from "lucide-react"
import { startThemeTransition, useTheme } from "@repo/ui/components/themeprovider"
import { Button } from "@repo/ui/components/ui/button"
import { Page } from "@repo/ui/components/ui/page"
import { Switch } from "@repo/ui/components/ui/switch"
import { toast } from "@repo/ui/components/ui/toast"
import { cn } from "@repo/ui/lib/utils"
import { saveAppearance } from "@/actions/settings.action"
import type { AppearancePrefs } from "@/lib/settings-values"
import { Section } from "../../profile/_components/section"

const THEMES = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
] as const

/**
 * Theme lives in the browser (next-themes applies it before the first paint, on this device). Density and reduced
 * motion are saved on the account and applied by the signed-in layout, so they follow the person to every device.
 */
export function AppearanceView({ initial }: { initial: AppearancePrefs }) {
    const router = useRouter()
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => setMounted(true), [])
    const [prefs, setPrefs] = React.useState(initial)
    const [saving, setSaving] = React.useState<keyof AppearancePrefs | null>(null)

    function pickTheme(next: string, e: React.MouseEvent) {
        if (next === theme) return
        if (prefs.reducedMotion) setTheme(next)
        else startThemeTransition(() => setTheme(next), { x: e.clientX, y: e.clientY })
    }

    async function save(patch: Partial<AppearancePrefs>, key: keyof AppearancePrefs) {
        const before = prefs
        setPrefs((p) => ({ ...p, ...patch }))
        setSaving(key)
        const res = await saveAppearance(patch)
        setSaving(null)
        if (!res.success) {
            setPrefs(before)
            toast.error(res.error ?? "Could not save that.")
            return
        }
        toast.success("Saved")
        // The layout renders the density / motion style; refresh so it applies without a reload.
        router.refresh()
    }

    return (
        <Page width="reading" title="Appearance" description="How the app looks: theme, density and motion.">
            <div className="flex w-full flex-col gap-3">
                <Section title="Theme" description="System follows your device's light or dark setting. Saved on this device.">
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
                        {THEMES.map((t) => {
                            const active = mounted && (theme ?? "system") === t.value
                            const Icon = t.icon
                            return (
                                <Button
                                    key={t.value}
                                    type="button"
                                    variant="outline"
                                    role="radio"
                                    aria-checked={active}
                                    onClick={(e) => pickTheme(t.value, e)}
                                    className={cn(
                                        "h-20 flex-col gap-2 rounded-xl text-sm font-medium",
                                        active && "border-neutral-900 ring-1 ring-neutral-900 dark:border-white dark:ring-white",
                                    )}
                                >
                                    <Icon className="h-5 w-5" />
                                    {t.label}
                                </Button>
                            )
                        })}
                    </div>
                </Section>

                <Section title="Layout" description="Saved on your account.">
                    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        <li className="flex items-center justify-between gap-3 py-3 first:pt-0">
                            <label htmlFor="ap-compact" className="min-w-0 cursor-pointer">
                                <span className="block text-sm font-medium text-neutral-900 dark:text-white">Compact</span>
                                <span className="block text-xs text-neutral-600 dark:text-neutral-400">Smaller text and tighter spacing, so more fits on the screen.</span>
                            </label>
                            <Switch
                                id="ap-compact"
                                checked={prefs.density === "compact"}
                                disabled={saving === "density"}
                                onCheckedChange={(v) => void save({ density: v ? "compact" : "comfortable" }, "density")}
                            />
                        </li>
                        <li className="flex items-center justify-between gap-3 py-3 last:pb-0">
                            <label htmlFor="ap-motion" className="min-w-0 cursor-pointer">
                                <span className="block text-sm font-medium text-neutral-900 dark:text-white">Reduce motion</span>
                                <span className="block text-xs text-neutral-600 dark:text-neutral-400">Turns off animations and transitions. Your device setting is always respected too.</span>
                            </label>
                            <Switch
                                id="ap-motion"
                                checked={prefs.reducedMotion}
                                disabled={saving === "reducedMotion"}
                                onCheckedChange={(v) => void save({ reducedMotion: v }, "reducedMotion")}
                            />
                        </li>
                    </ul>
                </Section>
            </div>
        </Page>
    )
}
