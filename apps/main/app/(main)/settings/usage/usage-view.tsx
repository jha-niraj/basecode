"use client"

import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, CalendarRange, Clock, Sigma } from "lucide-react"
import { ChartPanel, TrendLineChart, type ChartPoint } from "@repo/ui/components/charts/panel-charts"
import { EmptyState } from "@repo/ui/components/ui/empty-state"
import { Page } from "@repo/ui/components/ui/page"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { StatBand, type StatBandItem } from "@repo/ui/components/ui/stat-band"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/ui/table"
import { getAiUsage } from "@/actions/settings.action"
import { formatMicroUsd, formatTokens, shortDay } from "@/lib/format"
import type { AiUsageData, UsageBucket } from "@/lib/usage"

export const USAGE_KEY = ["settings", "usage"] as const

function hint(b: UsageBucket): string {
    if (b.calls === 0) return "no calls"
    return `${b.calls.toLocaleString("en-US")} ${b.calls === 1 ? "call" : "calls"}, ${b.requests.toLocaleString("en-US")} requests`
}

/** `ai_page_chat` -> "Ai page chat": the feature key as words. */
function featureLabel(feature: string): string {
    const words = feature.replace(/[_-]+/g, " ").trim()
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : feature
}

export function UsageView({ initialData }: { initialData: AiUsageData }) {
    const { data } = useQuery({
        queryKey: USAGE_KEY,
        queryFn: async () => {
            const res = await getAiUsage()
            if (!res.success) throw new Error(res.error)
            return res.data
        },
        initialData,
    })

    const items: StatBandItem[] = [
        { key: "today", icon: Clock, label: "Today", value: formatMicroUsd(data.today.costMicroUsd), hint: hint(data.today) },
        { key: "last7", icon: CalendarRange, label: "Last 7 days", value: formatMicroUsd(data.last7.costMicroUsd), hint: hint(data.last7) },
        { key: "last30", icon: Sigma, label: "Last 30 days", value: formatMicroUsd(data.last30.costMicroUsd), hint: hint(data.last30) },
        { key: "month", icon: CalendarDays, label: "This month", value: formatMicroUsd(data.thisMonth.costMicroUsd), hint: hint(data.thisMonth) },
    ]

    // US cents: a day's cost is usually well under a dollar, and the house chart prints whole numbers on its axis.
    const points: ChartPoint[] = data.daily.map((d) => ({
        label: shortDay(d.day),
        value: d.costMicroUsd === null ? null : Math.round(d.costMicroUsd / 100) / 100,
        gapNote: "No AI calls",
    }))

    return (
        <Page title="AI usage" description="What your AI requests cost - days are UTC days.">
            <div className="flex min-w-0 flex-col gap-4">
                <StatBand items={items} />

                <ChartPanel title="Cost per day" hint={data.unknownPrices ? "US cents, last 30 days. Some calls used a model with no known price and count as 0." : "US cents, last 30 days"}>
                    <TrendLineChart points={points} name="Cents" height={200} emptyMessage="No AI calls in the last 30 days" />
                </ChartPanel>

                <section className="min-w-0 rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
                    <div className="px-4 pb-2 pt-4">
                        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">Recent calls</h2>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400">Your latest {data.recent.length} AI calls, newest first.</p>
                    </div>
                    {data.recent.length === 0 ? (
                        <EmptyState title="No AI calls yet" description="Ask the AI something and each call shows up here with its cost." className="pb-8" />
                    ) : (
                        <ScrollArea orientation="both" className="min-w-0" viewportClassName="max-h-[30rem]">
                            <div className="min-w-[44rem] px-2 pb-2">
                                <Table scroller="parent">
                                    <TableHeader sticky>
                                        <TableRow>
                                            <TableHead>When</TableHead>
                                            <TableHead>Feature</TableHead>
                                            <TableHead>Model</TableHead>
                                            <TableHead className="text-right">Tokens in / out</TableHead>
                                            <TableHead className="text-right">Cache</TableHead>
                                            <TableHead className="text-right">Cost</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.recent.map((c) => {
                                            const cacheHit = c.cacheReadTokens > 0
                                            return (
                                                <TableRow key={c.id}>
                                                    <TableCell className="whitespace-nowrap text-xs text-neutral-600 dark:text-neutral-400">
                                                        {new Date(c.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                                    </TableCell>
                                                    <TableCell className="max-w-[12rem] truncate">
                                                        {featureLabel(c.feature)}
                                                        {c.failed && <span className="ml-1.5 text-xs text-rose-700 dark:text-rose-300">failed</span>}
                                                    </TableCell>
                                                    <TableCell className="max-w-[12rem] truncate font-mono text-xs">{c.model}</TableCell>
                                                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                        {formatTokens(c.inputTokens)} / {formatTokens(c.outputTokens)}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap text-right text-xs">
                                                        {cacheHit
                                                            ? <span title={`${c.cacheReadTokens.toLocaleString("en-US")} tokens read from cache`}>Hit, {Math.round((c.cacheReadTokens / Math.max(1, c.inputTokens)) * 100)}%</span>
                                                            : <span className="text-neutral-600 dark:text-neutral-400">Miss</span>}
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                        {c.priceKnown ? formatMicroUsd(c.costMicroUsd) : <span className="text-neutral-600 dark:text-neutral-400" title="This model has no known price">Unknown</span>}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </ScrollArea>
                    )}
                </section>
            </div>
        </Page>
    )
}
