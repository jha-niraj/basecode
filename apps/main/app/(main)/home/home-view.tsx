"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Bell, CircleDollarSign, HelpCircle, MessageSquare, MessagesSquare, NotebookPen, Settings } from "lucide-react"
import { ChartPanel, TrendLineChart, type ChartPoint } from "@repo/ui/components/charts/panel-charts"
import { AppLink } from "@repo/ui/components/app-link"
import { EmptyState } from "@repo/ui/components/ui/empty-state"
import { Page } from "@repo/ui/components/ui/page"
import { RelativeTime } from "@repo/ui/components/ui/relative-time"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { StatBand, type StatBandItem } from "@repo/ui/components/ui/stat-band"
import { StatStrip } from "@repo/ui/components/ui/stat-strip"
import { getDashboard } from "@/actions/dashboard.action"
import { formatMicroUsd, shortDay } from "@/lib/format"
import { ROUTES } from "@/lib/navigation"
import type { DashboardData } from "@/lib/dashboard"

const QUICK_LINKS = [
    { href: ROUTES.ai, label: "Ask the AI", line: "Start a new chat", icon: MessagesSquare },
    { href: ROUTES.notes, label: "Notes", line: "Write something down", icon: NotebookPen },
    { href: ROUTES.settings, label: "Settings", line: "Notifications, theme, usage", icon: Settings },
    { href: ROUTES.help, label: "Help", line: "Shortcuts and contact", icon: HelpCircle },
] as const

export function HomeView({ initialData }: { initialData: DashboardData }) {
    const { data } = useQuery({
        queryKey: ["home", "dashboard"],
        queryFn: async () => {
            const res = await getDashboard()
            if (!res.success) throw new Error(res.error)
            return res.data
        },
        initialData,
    })

    const items: StatBandItem[] = [
        { key: "notes", icon: NotebookPen, label: "Notes", value: data.notes.toLocaleString("en-US"), hint: "active", href: ROUTES.notes },
        { key: "chats", icon: MessageSquare, label: "AI chats", value: data.chats.toLocaleString("en-US"), hint: `${data.chatsLast7} in the last 7 days`, href: ROUTES.ai },
        { key: "cost", icon: CircleDollarSign, label: "AI cost", value: formatMicroUsd(data.costThisMonthMicroUsd), hint: "this month", href: ROUTES.settingsUsage },
        { key: "unread", icon: Bell, label: "Unread", value: data.unread.toLocaleString("en-US"), hint: "notifications", href: `${ROUTES.notifications}?tab=unread`, tone: data.unread > 0 ? "amber" : undefined },
    ]

    const points: ChartPoint[] = data.chatsPerDay.map((d) => ({ label: shortDay(d.day), value: d.count }))

    return (
        <Page title="Home" description="How your work is going, and where you left off." body="page">
            <StatBand items={items} />

            <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                <ChartPanel title="New AI chats per day" hint="Last 14 days (UTC)" href={ROUTES.ai}>
                    <TrendLineChart points={points} name="Chats" height={220} emptyMessage="No new chats in the last 14 days" />
                </ChartPanel>

                <section className="flex min-w-0 flex-col rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
                    <h2 className="truncate text-sm font-semibold text-neutral-900 dark:text-white">Recent activity</h2>
                    <p className="truncate text-xs text-neutral-600 dark:text-neutral-400">Your latest chats and notes</p>
                    {data.recent.length === 0 ? (
                        <EmptyState
                            className="flex-1 p-4 sm:p-4"
                            icon={<MessagesSquare />}
                            title="Nothing here yet"
                            description="Start a chat or write a note and it shows up here."
                        />
                    ) : (
                        <ScrollArea orientation="vertical" className="mt-2 min-w-0" viewportClassName="max-h-[15rem]">
                            <ul className="flex min-w-0 flex-col">
                                {data.recent.map((r) => {
                                    const Icon = r.kind === "chat" ? MessageSquare : NotebookPen
                                    const href = r.kind === "chat" ? `${ROUTES.ai}/${r.id}` : `${ROUTES.notes}?open=${encodeURIComponent(r.id)}`
                                    return (
                                        <li key={`${r.kind}-${r.id}`}>
                                            <AppLink href={href} className="flex min-h-10 min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-950/60">
                                                <Icon className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400" />
                                                <span className="min-w-0 flex-1 truncate text-sm text-neutral-900 dark:text-white">{r.title || (r.kind === "chat" ? "Untitled chat" : "Untitled note")}</span>
                                                <span className="shrink-0 text-xs text-neutral-600 dark:text-neutral-400">
                                                    {r.kind === "chat" ? "Chat" : "Note"} - <RelativeTime value={r.at} />
                                                </span>
                                            </AppLink>
                                        </li>
                                    )
                                })}
                            </ul>
                        </ScrollArea>
                    )}
                </section>
            </div>

            <StatStrip cols={4} dense>
                {QUICK_LINKS.map((q) => {
                    const Icon = q.icon
                    return (
                        <AppLink
                            key={q.href}
                            href={q.href}
                            className="flex min-w-0 cursor-pointer items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800/60"
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                                <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-neutral-900 dark:text-white">{q.label}</span>
                                <span className="block truncate text-xs text-neutral-600 dark:text-neutral-400">{q.line}</span>
                            </span>
                        </AppLink>
                    )
                })}
            </StatStrip>
        </Page>
    )
}
