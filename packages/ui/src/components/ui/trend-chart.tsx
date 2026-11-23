"use client"

import {
    LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceDot,
} from "recharts"
import { ResponsiveChart } from "./responsive-chart"
import { cn } from "../../lib/utils"

/**
 * TrendChart - the ONE way a screen shows a figure moving over time.
 *
 * ## What it is, and how it differs from `ActivityLineChart`
 *
 * `ActivityLineChart` is a dashboard PANEL: a title, a subtitle, a legend, several named
 * series being compared. This is the other shape - one metric (occasionally two), no
 * legend, no chrome, sitting directly under a `StatBand` to answer "and which way is it
 * going?". Reach for that one when the question is "how do these compare", this one when
 * the question is "what is this number doing".
 *
 * Keeping them separate is deliberate. Adding a `minimal` flag to the other one would have
 * produced a component with two personalities and a prop that silently turns half its
 * features off.
 *
 * ## Why it looks the way it does
 *
 * The restraint IS the design. A trend line earns attention by being the only thing moving
 * on the screen, so: horizontal hairlines only (vertical ones fight the line), no axis
 * lines, no tick marks, a sparse Y axis, and the last point marked with a dot because the
 * current value is the one people look for. Everything is `currentColor` or a `--so-*`
 * token, so it inherits the theme rather than carrying its own palette.
 *
 * ## Why not visx
 *
 * A visx-based chart was considered (it is what the `@ncdai/metrics-01` block uses) and
 * rejected: it would be a SECOND chart system beside recharts, it pins alpha releases, and
 * it pulls `motion` alongside the `framer-motion` this repo already has. On Cloudflare
 * Workers the 10 MiB gzip ceiling is already close enough that recharts is lazy-loaded at
 * several call sites. The look was worth taking; the dependency was not.
 *
 * ## Use
 *
 *     <div className="h-[220px] w-full">
 *         <TrendChart data={days} xKey="date" series={[{ key: "clicks", name: "Clicks" }]} />
 *     </div>
 *
 * The HEIGHT GOES ON THE PARENT, never on the chart - see `responsive-chart.tsx` for why a
 * percentage height makes recharts warn on every render.
 */

export interface TrendSeries {
    /** The field on each row. */
    key: string
    /** Shown in the tooltip. */
    name: string
    /**
     * Defaults to the neutral chart ramp, which is what you want: colour here should
     * distinguish series, not decorate. Pass a hue only when the series IS an
     * identity (a channel, a project).
     */
    color?: string
}

export interface TrendChartProps {
    data: Array<Record<string, string | number>>
    series: TrendSeries[]
    /** The field holding the x value. */
    xKey: string
    /** Formats the tooltip value - currency, percentages, durations. */
    formatValue?: (value: number) => string
    /** Formats the x tick and the tooltip heading. Keep ticks SHORT - "04 Sep", not a date. */
    formatX?: (value: string | number) => string
    /** Hides the Y axis entirely. For a sparkline-sized chart where the tooltip is enough. */
    hideY?: boolean
    /** Marks the final point of the first series. On by default - it is the current value. */
    markLast?: boolean
    /** Shown in place of the chart when there is nothing to draw. */
    emptyLabel?: string
    className?: string
}

/** The neutral ramp. Colour distinguishes series; it does not decorate. */
const RAMP = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"]

export function TrendChart({
    data, series, xKey, formatValue, formatX, hideY = false,
    markLast = true, emptyLabel = "No data yet", className,
}: TrendChartProps) {
    const first = series[0]
    // Counts are whole numbers: without this a 0..1 range gets ticks at 0.25/0.5/0.75 that a
    // whole-number formatter prints as "0, 1, 1" - a scale that reads as broken.
    const integerData = data.every((row) => series.every((s) => {
        const v = row[s.key]
        return typeof v !== "number" || Number.isInteger(v)
    }))
    const last = data.length > 0 ? data[data.length - 1] : undefined

    /*
     * An empty chart is not an empty box. Recharts will happily render axes around nothing,
     * which reads as "broken" rather than "nothing happened yet".
     */
    if (data.length === 0 || !first) {
        return (
            <div className={cn(
                "flex h-full w-full items-center justify-center",
                className,
            )}>
                <p className="text-xs font-medium text-muted-foreground">{emptyLabel}</p>
            </div>
        )
    }

    return (
        <div className={cn("h-full w-full text-[var(--so-ink-4)]", className)}>
            <ResponsiveChart>
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: hideY ? 0 : -18 }}>
                    {/* Horizontal only. Vertical gridlines cross the line they are meant to
                        support and turn a trend into a grid with a wire through it. */}
                    <CartesianGrid
                        horizontal
                        vertical={false}
                        stroke="currentColor"
                        strokeOpacity={0.14}
                    />
                    <XAxis
                        dataKey={xKey}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        minTickGap={24}
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        tickFormatter={formatX ? (v) => formatX(v) : undefined}
                    />
                    {!hideY && (
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            width={44}
                            // Four ticks is enough to read a scale. More is a table.
                            tickCount={4}
                            allowDecimals={!integerData}
                            tick={{ fontSize: 11, fill: "currentColor" }}
                            tickFormatter={formatValue ? (v: number) => formatValue(v) : undefined}
                        />
                    )}
                    <Tooltip
                        cursor={{ stroke: "currentColor", strokeOpacity: 0.25, strokeWidth: 1 }}
                        contentStyle={{
                            background: "var(--so-surface)",
                            border: "1px solid var(--so-line)",
                            borderRadius: "var(--so-radius, 8px)",
                            color: "var(--so-ink)",
                            fontSize: 12,
                            // `tabular-nums` here too: a tooltip that reflows as you move
                            // along the line is the most distracting version of this chart.
                            fontVariantNumeric: "tabular-nums",
                            boxShadow: "none",
                        }}
                        labelFormatter={formatX ? (v) => formatX(v as string | number) : undefined}
                        // Same signature the sibling chart uses - recharts types the value
                        // loosely, so coerce rather than annotate.
                        formatter={(value) => (formatValue ? formatValue(Number(value)) : Number(value).toLocaleString())}
                    />
                    {series.map((s, i) => (
                        <Line
                            key={s.key}
                            type="monotone"
                            dataKey={s.key}
                            name={s.name}
                            stroke={s.color ?? RAMP[i % RAMP.length]}
                            strokeWidth={2}
                            // No dot per point - on 90 days that is 90 dots and no line.
                            dot={false}
                            activeDot={{ r: 3, strokeWidth: 0 }}
                            isAnimationActive={false}
                        />
                    ))}
                    {/* The current value, marked. It is the point everyone looks for, and
                        without it the line just stops at the right edge. */}
                    {markLast && last && (
                        <ReferenceDot
                            x={last[xKey] as string | number}
                            y={last[first.key] as number}
                            r={3}
                            fill={first.color ?? RAMP[0]}
                            stroke="var(--so-surface)"
                            strokeWidth={2}
                        />
                    )}
                </LineChart>
            </ResponsiveChart>
        </div>
    )
}
