"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Monitor, Smartphone, Tablet } from "lucide-react"
import { Button } from "@repo/ui/components/ui/button"
import { ConfirmPopover } from "@repo/ui/components/ui/confirm-popover"
import { RelativeTime } from "@repo/ui/components/ui/relative-time"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { toast } from "@repo/ui/components/ui/toast"
import { revokeOtherSessions, revokeSession } from "@/actions/profile.action"
import type { ProfileSessionRow } from "@/types/profile"
import { Section } from "./section"
import { displayIp, parseUserAgent, type DeviceKind } from "./user-agent"

const ICON: Record<DeviceKind, React.ComponentType<{ className?: string }>> = { phone: Smartphone, tablet: Tablet, desktop: Monitor }

export function SessionsTabPanel({ sessions }: { sessions: ProfileSessionRow[] | null }) {
    const router = useRouter()
    const [rows, setRows] = React.useState(sessions)
    React.useEffect(() => setRows(sessions), [sessions])

    if (!rows) {
        return (
            <Section title="Signed-in devices">
                <p className="text-sm text-neutral-600 dark:text-neutral-400">The device list could not be loaded. Refresh the page to try again.</p>
            </Section>
        )
    }

    const others = rows.filter((s) => !s.current).length

    async function revoke(id: string) {
        const res = await revokeSession(id)
        if (!res.success) {
            toast.error(res.error ?? "Could not sign that device out.")
            throw new Error("revoke failed")
        }
        setRows((list) => list?.filter((s) => s.id !== id) ?? null)
        toast.success("Device signed out")
        router.refresh()
    }

    async function revokeOthers() {
        const res = await revokeOtherSessions()
        if (!res.success) {
            toast.error(res.error ?? "Could not sign the other devices out.")
            throw new Error("revoke others failed")
        }
        setRows((list) => list?.filter((s) => s.current) ?? null)
        toast.success("Other devices signed out")
        router.refresh()
    }

    return (
        <Section
            title="Signed-in devices"
            description={others === 0 ? "Only this device is signed in." : `This device and ${others} other${others === 1 ? "" : "s"}.`}
            action={
                others > 0 ? (
                    <ConfirmPopover title="Sign out every other device?" description="This device stays signed in." confirmLabel="Sign out others" onConfirm={revokeOthers}>
                        <Button type="button" variant="outline" size="sm">Sign out other devices</Button>
                    </ConfirmPopover>
                ) : undefined
            }
        >
            <ScrollArea orientation="vertical" viewportClassName="max-h-[30rem]">
                <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {rows.map((s) => {
                        const ua = parseUserAgent(s.userAgent)
                        const Icon = ICON[ua.kind]
                        const ip = displayIp(s.ipAddress)
                        return (
                            <li key={s.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
                                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                                    <Icon className="size-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-neutral-900 dark:text-white">
                                        {ua.label}
                                        {s.current && <span className="ml-2 text-xs font-normal text-neutral-600 dark:text-neutral-400">This device</span>}
                                    </p>
                                    <p className="truncate text-xs text-neutral-600 dark:text-neutral-400">
                                        Active <RelativeTime value={s.updatedAt} />
                                        {ip ? ` - ${ip}` : ""}
                                    </p>
                                </div>
                                {!s.current && (
                                    <ConfirmPopover title="Sign this device out?" confirmLabel="Sign out" onConfirm={() => revoke(s.id)}>
                                        <Button type="button" variant="ghost" size="sm" className="shrink-0">Sign out</Button>
                                    </ConfirmPopover>
                                )}
                            </li>
                        )
                    })}
                </ul>
            </ScrollArea>
        </Section>
    )
}
