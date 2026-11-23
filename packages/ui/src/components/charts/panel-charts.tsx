'use client';

import { ArrowRight } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppLink } from '../app-link';
import { cn } from '../../lib/utils';
import { CHART_AXIS_PROPS, CHART_BAR_CURSOR, CHART_GRID_PROPS, CHART_MONO, CHART_TOOLTIP_STYLE, seriesColor } from '../../lib/chart-theme';
import { ChartEmpty } from './chart-empty';
import { useChartMotion } from '../../hooks/use-chart-motion';

/**
 * The house chart panels (the owner, 2026-10-18 - the house style for every module landing page). One metric per chart in its real unit, neutral ink, amber on the ONE datum to look at
 * (the latest point, or the lowest bar), a null value is a gap / a missing bar - never 0 - and an all-empty chart is
 * `ChartEmpty`. Evenly spaced axis labels, thinned from the END (`equidistantPreserveEnd`) so the newest bucket - this month, the amber datum - always keeps its label.
 */

export function ChartPanel({ title, hint, href, className, children }: {
    title: string; hint?: React.ReactNode; href?: string; className?: string; children: React.ReactNode;
}) {
    return (
        <section className={cn('flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card p-4', className)}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-neutral-900 dark:text-white">{title}</h2>
                    {hint && <p className="truncate text-xs text-neutral-500">{hint}</p>}
                </div>
                {href && (
                    <AppLink href={href} className="inline-flex shrink-0 items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
                        View <ArrowRight className="h-3 w-3" />
                    </AppLink>
                )}
            </div>
            {children}
        </section>
    );
}

/** `gapNote` is what the tooltip says over a null point (a gap) - e.g. "payroll not run" - instead of "Nothing recorded". */
export interface ChartPoint { label: string; value: number | null; note?: string; gapNote?: string }

/**
 * Value formats: '%' (attendance, scores), money (compact on the axis, full in the tooltip), or a count.
 * Money is `unit="money"` plus `currency` (the tenant's ISO code, e.g. "NPR" / "INR"; null = unknown, figures print
 * bare - never a guessed code). The legacy `unit="NPR"` still works and means money in NPR unless `currency` overrides it.
 */
const isMoney = (unit: string | undefined) => unit === 'money' || unit === 'NPR';
const moneyCode = (unit: string | undefined, currency: string | null | undefined) =>
    currency !== undefined ? currency : unit === 'NPR' ? 'NPR' : null;
const fmt = (unit: string | undefined, currency?: string | null) => (v: number) => {
    if (unit === '%') return `${v}%`;
    if (isMoney(unit)) {
        const code = moneyCode(unit, currency);
        const n = Math.round(v).toLocaleString();
        return code ? `${code} ${n}` : n;
    }
    return v.toLocaleString();
};
/** Compact axis money: 1.5k / 12k / 2.5L - one decimal under 10 so ticks never repeat ("2k, 2k" at 1,500 and 2,250). */
const compact = (v: number, div: number, suffix: string) => {
    const n = v / div;
    return `${Math.abs(n) < 10 && !Number.isInteger(n) ? n.toFixed(1).replace(/\.0$/, '') : Math.round(n)}${suffix}`;
};
const axisFmt = (unit: string | undefined) => (v: number) =>
    isMoney(unit) ? (Math.abs(v) >= 100_000 ? compact(v, 100_000, 'L') : Math.abs(v) >= 1000 ? compact(v, 1000, 'k') : `${v}`) : fmt(unit)(v);

/**
 * Headroom (the owner, 2026-10-21: "currently it is going up to 3K, so we can add 4K and 5K; if it is going up to 8, then
 * 9 and 10"): the top of the y axis is the data's max plus a fifth, rounded up to a nice number (3k -> 4k, 8 -> 10), so the highest point never touches the top edge and the axis ends on a round label. Percent charts stop at 100.
 */
export function niceAxis(max: number, unit?: string): { max: number; ticks: number[] } {
    if (unit === '%' && max * 1.2 >= 75) return { max: 100, ticks: [0, 25, 50, 75, 100] };
    if (!(max > 0)) return unit === '%' ? { max: 100, ticks: [0, 25, 50, 75, 100] } : { max: 1, ticks: [0, 1] };
    const target = max * 1.2;
    // A round step for about four gaps, and the top the first multiple of it past the headroom - then the ticks are
    // drawn from that step (browser-pass backlog 2026-11-13). Before, the top was rounded on its own (1.5L) and recharts
    // chose its own step under it (40k): 0, 40k, 80k, 1.2L, 1.5L, the last gap shorter than the rest. Counts stay whole
    // (allowDecimals is off on every axis), so 2.5 only from 10 up.
    const raw = target / 4;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const mults = pow < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
    const step = Math.max(1, mults.map((m) => m * pow).find((n) => n >= raw) ?? 10 * pow);
    const top = Math.ceil(target / step) * step;
    const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
    return { max: top, ticks };
}
/** The y-axis top alone (kept for callers that only need the number). */
export function niceAxisMax(max: number, unit?: string): number {
    return niceAxis(max, unit).max;
}
/** domain + ticks for a YAxis: a caller's fixed domain wins; headroom off restores recharts' own 'auto'. */
const yAxisScale = (values: (number | null)[], unit: string | undefined, domain: [number, number] | undefined, headroom: boolean): { domain: [number, number | 'auto']; ticks?: number[] } => {
    if (domain) return { domain };
    if (!headroom) return { domain: [0, 'auto'] };
    const { max, ticks } = niceAxis(Math.max(0, ...values.map((v) => v ?? 0)), unit);
    return { domain: [0, max], ticks };
};

/** Average width of one character of the 11px / 500 axis font. */
const AXIS_CHAR_PX = 6.2;

/**
 * Room at each end of a line chart's x axis: half the longest label. A line's first and last points sit ON the plot's
 * edges, so their labels hang half outside it; recharts checks the end label against the edge and, when it does not fit,
 * draws that one label alone, clipped ("Karti", "Second Termin" - browser-pass backlog 2026-11-13/14).
 */
export function edgePadding(labels: string[]): { left: number; right: number } {
    const longest = Math.max(0, ...labels.map((l) => l.length));
    const half = Math.ceil((longest * AXIS_CHAR_PX) / 2);
    return { left: Math.min(64, Math.max(14, half - 4)), right: Math.min(72, Math.max(22, half + 4)) };
}

/** Up to this many bars, every bar keeps its label - shortened to its bar's width, the full name on hover. */
const FIT_LABELS_UP_TO = 12;

/**
 * A line chart's axis labels are clipped to this many characters (with "…"); the tooltip keeps the whole label. Exam
 * names ran to 27 characters and recharts measures the FULL text when it decides which labels fit, so an end label
 * wider than the edge room was dropped. Pages used to cut names themselves (to 14-15 characters, also in the tooltip).
 */
const LINE_LABEL_MAX = 18;
export const clipLabel = (v: unknown) => {
    const t = String(v ?? '');
    return t.length > LINE_LABEL_MAX ? `${t.slice(0, LINE_LABEL_MAX - 1).trimEnd()}…` : t;
};

/**
 * A category label that fits its bar. recharts thins long labels by DROPPING them, so eight subjects showed one name
 * ("Computer Scien") under eight bars. This keeps all of them and shortens each to the bar's width instead.
 */
function FitTick(props: { x?: number; y?: number; width?: number; visibleTicksCount?: number; index?: number; longest?: number; payload?: { value?: unknown } }) {
    const { x = 0, y = 0, width, visibleTicksCount, index = 0, longest = 0, payload } = props;
    const full = String(payload?.value ?? '');
    const band = width && visibleTicksCount ? width / visibleTicksCount : 0;
    const count = visibleTicksCount ?? 0;
    // Too narrow for three letters a bar (twelve months in a quarter-width panel read "De Ja Fe..."): label every
    // `step`-th bar, counting back from the last so the latest always shows. Once labels are being dropped anyway, drop
    // enough that the longest label fits whole ("Jan 26", not "Jan..."), keeping at least two.
    const MIN_CHARS = 3;
    // Room for three letters AND the ellipsis when the label is longer than three ("De..." is not a label).
    const needChars = Math.min(Math.max(longest, full.length), MIN_CHARS + 1);
    let step = band ? Math.max(1, Math.ceil((needChars * AXIS_CHAR_PX + 4) / band)) : 1;
    if (step > 1 && longest > 0) step = Math.min(Math.max(step, Math.ceil((longest * AXIS_CHAR_PX + 6) / band)), Math.max(2, Math.ceil(count / 2)));
    if (step > 1 && count > 0 && (count - 1 - index) % step !== 0) return <g />;
    const room = band * step;
    const max = room ? Math.max(MIN_CHARS, Math.floor((room - 4) / AXIS_CHAR_PX)) : full.length;
    const shown = full.length > max ? `${full.slice(0, max - 1).trimEnd()}…` : full;
    // A thinned label wider than its bar would hang past the plot's right edge on the last bar - end it at that bar's edge.
    const atEnd = step > 1 && index === count - 1 && shown.length * AXIS_CHAR_PX > band;
    return (
        <g transform={`translate(${atEnd ? x + band / 2 : x},${y})`}>
            <text dy={12} textAnchor={atEnd ? 'end' : 'middle'} fontSize={11} fontWeight={500} fill={CHART_AXIS_PROPS.tick.fill} className={CHART_AXIS_PROPS.tick.className}>
                {shown !== full && <title>{full}</title>}
                {shown}
            </text>
        </g>
    );
}

/** One series over time: neutral line and faint fill, the latest point amber. */
export function TrendLineChart({ points, unit, currency, domain, height = 176, emptyMessage, name = 'Value', headroom = true, keepLastLabel = true }: {
    points: ChartPoint[]; unit?: string; currency?: string | null; domain?: [number, number]; height?: number; emptyMessage: string; name?: string;
    /** Round the axis top up past the max (default on); off restores recharts' own 'auto'. */
    headroom?: boolean;
    /**
     * When the axis has to thin its labels, keep the LAST one (this month) instead of the first. Off by default (the
     * old behaviour). The thinning counts from the start, so on a half-width chart of 12 months the label under the
     * newest point - the amber datum - was the one dropped.
     */
    keepLastLabel?: boolean;
}) {
    const { motion, popClass } = useChartMotion();
    const lastIndex = points.reduce((k, p, i) => (p.value !== null ? i : k), -1);
    // All zero is nothing to draw: a flat line on a 0-1 axis beside "No payments this month" panels read as broken
    // (browser-pass backlog 2026-11-13). Same empty state as no data.
    if (lastIndex === -1 || points.every((p) => !p.value)) return <ChartEmpty kind="line" message={emptyMessage} height={height} />;
    const f = fmt(unit, currency);
    return (
        <div className="min-w-0" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid {...CHART_GRID_PROPS} />
                    {/* Edge room from the longest label (edgePadding) so the first and last labels fit. */}
                    <XAxis dataKey="label" {...CHART_AXIS_PROPS} interval={keepLastLabel ? 'equidistantPreserveEnd' : 'equidistantPreserveStart'} minTickGap={4} padding={edgePadding(points.map((p) => clipLabel(p.label)))} tickFormatter={clipLabel} />
                    <YAxis {...yAxisScale(points.map((p) => p.value), unit, domain, headroom)} allowDecimals={false} {...CHART_AXIS_PROPS} tickFormatter={axisFmt(unit)} />
                    {/* filterNull off so hovering a gap says WHY it is a gap (recharts drops null entries by default). */}
                    <Tooltip {...CHART_TOOLTIP_STYLE} cursor={{ stroke: CHART_MONO.mark, strokeDasharray: '3 3' }} separator="" filterNull={false}
                        formatter={(v, _n, item) => [v === null || v === undefined ? (item.payload.gapNote ?? 'Nothing recorded') : `${f(Number(v))}${item.payload.note ? ` (${item.payload.note})` : ''}`, '']} />
                    <Area type="monotone" dataKey="value" name={name} stroke={CHART_MONO.line} strokeWidth={2} fill={CHART_MONO.line} connectNulls={false} {...motion}
                        dot={(p: { cx?: number; cy?: number; index?: number }) => p.cx !== undefined && p.cy !== undefined && points[p.index ?? -1]?.value !== null
                            ? <circle key={`d${p.index}`} cx={p.cx} cy={p.cy} r={p.index === lastIndex ? 4 : 2.5} fill={p.index === lastIndex ? seriesColor(0) : CHART_MONO.mark} stroke="none" className={p.index === lastIndex ? popClass : undefined} />
                            : <g key={`d${p.index}`} />}
                        activeDot={{ r: 4, fill: CHART_MONO.mark, stroke: 'none' }} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

/** One bar per category in its real unit; the lowest (or none) amber. Categories with no value are listed under it. */
export function CategoryBarChart({ bars, unit, currency, domain, height = 176, emptyMessage, highlight = 'lowest', highlightLabel, missingWord = 'Nothing yet', name = 'Value', headroom = true }: {
    bars: ChartPoint[]; unit?: string; currency?: string | null; domain?: [number, number]; height?: number; emptyMessage: string; headroom?: boolean;
    /** Which bar is amber: the lowest, the highest (the largest debt), none - or `highlightLabel` names it. */
    highlight?: 'lowest' | 'highest' | 'none'; highlightLabel?: string; missingWord?: string; name?: string;
}) {
    const { motion } = useChartMotion();
    const known = bars.filter((b) => b.value !== null);
    const missing = bars.filter((b) => b.value === null);
    if (known.length === 0 || known.every((x) => !x.value)) return <ChartEmpty message={emptyMessage} height={height} />;
    // A lone bar IS the largest (Assets' one category drew grey under "the largest in amber"); a lone "lowest" stays
    // unmarked - one class is not the weak one.
    const extreme = highlightLabel ? null : known.length > 1 && highlight === 'lowest' ? Math.min(...known.map((b) => b.value!))
        : highlight === 'highest' && known.some((b) => b.value! > 0) ? Math.max(...known.map((b) => b.value!)) : null;
    // Amber marks ONE datum: when several bars share the lowest (or highest), none is marked (exam browser pass F15/F78).
    const lowest = extreme !== null && known.filter((b) => b.value === extreme).length === 1 ? extreme : null;
    const f = fmt(unit, currency);
    return (
        <div className="min-w-0">
            <div className="min-w-0" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={known} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                        <CartesianGrid {...CHART_GRID_PROPS} />
                        <XAxis dataKey="label" {...CHART_AXIS_PROPS} {...(known.length <= FIT_LABELS_UP_TO ? { interval: 0, tick: <FitTick longest={Math.max(0, ...known.map((k) => String(k.label).length))} /> } : { interval: 'equidistantPreserveEnd' as const, minTickGap: 2 })} />
                        <YAxis {...yAxisScale(known.map((b) => b.value), unit, domain, headroom)} allowDecimals={false} {...CHART_AXIS_PROPS} tickFormatter={axisFmt(unit)} />
                        <Tooltip {...CHART_TOOLTIP_STYLE} cursor={CHART_BAR_CURSOR} separator=""
                            formatter={(v, _n, item) => [`${f(Number(v))}${item.payload.note ? ` (${item.payload.note})` : ''}`, '']} />
                        <Bar dataKey="value" name={name} radius={[3, 3, 0, 0]} {...motion} maxBarSize={32}>
                            {known.map((b) => <Cell key={b.label} fill={(highlightLabel ? b.label === highlightLabel && (b.value ?? 0) > 0 : b.value === lowest) ? seriesColor(0) : CHART_MONO.mark} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            {missing.length > 0 && (
                <p className="mt-2 truncate text-xs text-neutral-500" title={missing.map((m) => m.label).join(', ')}>
                    {missingWord}: {missing.map((m) => m.label).join(', ')}
                </p>
            )}
        </div>
    );
}

/**
 * Two series of the SAME unit side by side per category (billed vs paid, needed vs available): two neutral shades,
 * a key under it, and the categories where the second falls short of the first can be marked amber (`shortAmber`).
 * Never two units - that is two charts.
 */
export function SplitBarChart({ bars, first, second, unit, currency, height = 176, emptyMessage, shortAmber = false, headroom = true }: {
    bars: { label: string; a: number | null; b: number | null }[];
    first: string;
    second: string;
    unit?: string;
    /** Money only: the tenant's currency code (null = bare figures). */
    currency?: string | null;
    height?: number;
    emptyMessage: string;
    shortAmber?: boolean;
    headroom?: boolean;
}) {
    const { motion } = useChartMotion();
    const known = bars.filter((x) => x.a !== null || x.b !== null);
    if (known.length === 0 || known.every((x) => !x.a && !x.b)) return <ChartEmpty message={emptyMessage} height={height} />;
    const f = fmt(unit, currency);
    const A = '#525252';
    const B = '#a3a3a3';
    return (
        <div className="min-w-0">
            <div className="min-w-0" style={{ height }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={known} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barGap={2}>
                        <CartesianGrid {...CHART_GRID_PROPS} />
                        <XAxis dataKey="label" {...CHART_AXIS_PROPS} {...(known.length <= FIT_LABELS_UP_TO ? { interval: 0, tick: <FitTick longest={Math.max(0, ...known.map((k) => String(k.label).length))} /> } : { interval: 'equidistantPreserveEnd' as const, minTickGap: 2 })} />
                        <YAxis {...yAxisScale(known.flatMap((x) => [x.a, x.b]), unit, undefined, headroom)} allowDecimals={false} {...CHART_AXIS_PROPS} tickFormatter={axisFmt(unit)} />
                        <Tooltip {...CHART_TOOLTIP_STYLE} cursor={CHART_BAR_CURSOR} formatter={(v, n) => [v === null || v === undefined ? '-' : f(Number(v)), String(n)]} />
                        <Bar dataKey="a" name={first} fill={A} radius={[3, 3, 0, 0]} {...motion} maxBarSize={18} />
                        <Bar dataKey="b" name={second} radius={[3, 3, 0, 0]} {...motion} maxBarSize={18}>
                            {known.map((x) => <Cell key={x.label} fill={shortAmber && x.a !== null && x.b !== null && x.b < x.a ? seriesColor(0) : B} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-600 dark:text-neutral-300">
                <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: A }} />{first}</li>
                <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: B }} />{second}{shortAmber ? ' (amber when short)' : ''}</li>
            </ul>
        </div>
    );
}
