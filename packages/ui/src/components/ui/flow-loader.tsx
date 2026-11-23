import { cn } from "../../lib/utils"

/**
 * THE FLOW LOADERS: a whole-page loader shows the KIND of work that is arriving, drawn in one family of pieces - a card
 * with a hairline, grey text lines, a thin ink progress line, a green tick for done, amber on the one mark.
 *
 *   page     a page turns - the fallback for anything without its own (what `AppLoader` draws by default)
 *   list     rows drop into a list and ticks land, one row marked in amber
 *   report   a document's lines fill in, then a small chart pops on
 *   files    files drop into a folder, one by one
 *   ai       the assistant's bars talk while what needs you slides into the column
 *
 * One 3.2s loop; only transform and opacity move; under `prefers-reduced-motion` the scene stands still on a frame that
 * reads (every mark shown). Full screen draws the same scene larger (up to 1.6x), never a different one. This is the
 * WHOLE-PAGE tier only: a region with a shape still gets its skeleton (AGENTS.md, loading states).
 */

export type FlowLoaderKind = "page" | "list" | "report" | "files" | "ai"

const CAPTION: Record<FlowLoaderKind, string> = {
    page: "Opening the page",
    list: "Getting the list",
    report: "Putting the report together",
    files: "Getting your files",
    ai: "Getting things ready",
}

const STYLES = `
.gkf-tick { opacity: 0; transform-box: fill-box; transform-origin: center; animation: gkf-tick 3.2s ease-out infinite; }
@keyframes gkf-tick { 0% { opacity: 0; transform: scale(.4); } 8% { opacity: 1; transform: scale(1.15); } 12%,80% { opacity: 1; transform: scale(1); } 92%,100% { opacity: 0; } }
.gkf-row { opacity: 0; animation: gkf-row 3.2s ease-out infinite; }
@keyframes gkf-row { 0% { opacity: 0; transform: translateX(-6px); } 10%,82% { opacity: 1; transform: translateX(0); } 94%,100% { opacity: 0; } }
.gkf-bar { transform-box: fill-box; transform-origin: 0 50%; animation: gkf-bar 3.2s cubic-bezier(.45,0,.2,1) infinite; }
@keyframes gkf-bar { 0% { transform: scaleX(0); } 70%,85% { transform: scaleX(1); } 100% { transform: scaleX(1); opacity: 0; } }
.gkf-print { animation: gkf-print 3.2s cubic-bezier(.45,0,.2,1) infinite; }
@keyframes gkf-print { 0% { transform: translateY(-62px); } 55%,86% { transform: translateY(0); } 100% { transform: translateY(0); opacity: 0; } }
.gkf-stamp { opacity: 0; transform-box: fill-box; transform-origin: center; animation: gkf-stamp 3.2s infinite; }
@keyframes gkf-stamp { 0%,58% { opacity: 0; transform: scale(1.7) rotate(-16deg); } 66% { opacity: 1; transform: scale(.94) rotate(-9deg); } 70%,88% { opacity: 1; transform: scale(1) rotate(-9deg); } 100% { opacity: 0; } }
.gkf-cell { opacity: 0; animation: gkf-cell 3.2s ease-out infinite; }
@keyframes gkf-cell { 0% { opacity: 0; transform: translateY(-8px); } 10%,84% { opacity: 1; transform: translateY(0); } 96%,100% { opacity: 0; } }
.gkf-bars rect { transform-box: fill-box; transform-origin: center; animation: gkf-bars 1.1s ease-in-out infinite; }
@keyframes gkf-bars { 0%,100% { transform: scaleY(.45); } 50% { transform: scaleY(1); } }
.gkf-card { animation: gkf-card 3.2s cubic-bezier(.45,0,.2,1) infinite; }
@keyframes gkf-card { 0% { transform: translate(-40px,0); opacity: 0; } 18% { opacity: 1; } 55%,85% { transform: translate(0,0); opacity: 1; } 100% { opacity: 0; } }
.gkf-leaf { transform-box: fill-box; transform-origin: 0% 50%; animation: gkf-leaf 2.4s cubic-bezier(.45,0,.2,1) infinite; }
@keyframes gkf-leaf { 0%,10% { transform: scaleX(1); } 50% { transform: scaleX(-1); } 60%,100% { transform: scaleX(-1); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
    .gkf-tick, .gkf-row, .gkf-bar, .gkf-print, .gkf-stamp, .gkf-cell, .gkf-bars rect, .gkf-card, .gkf-leaf { animation: none !important; }
    .gkf-tick, .gkf-row, .gkf-cell, .gkf-stamp, .gkf-card { opacity: 1 !important; }
}
`

const S2 = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
const S3 = { ...S2, strokeWidth: 3 }
/** The one mark that needs the eye (amber, readable on white and on the dark ground). */
const GOLD = "#b45309"
const GREEN = "text-emerald-600 dark:text-emerald-400"
const delay = (s: number) => ({ animationDelay: `${s}s` })

function Line({ x, y, w, h = 4, o = 0.12 }: { x: number; y: number; w: number; h?: number; o?: number }) {
    return <rect x={x} y={y} width={w} height={h} rx={h / 2} fill="currentColor" opacity={o} />
}

function Tick({ x, y, at }: { x: number; y: number; at: number }) {
    return <path {...S2} className={cn("gkf-tick", GREEN)} style={delay(at)} d={`M${x} ${y} l4 4 l8 -8`} />
}

function Scene({ kind }: { kind: FlowLoaderKind }) {
    switch (kind) {
        case "list":
            return (
                <>
                    <rect {...S2} x="70" y="18" width="180" height="124" rx="10" />
                    {[34, 58, 82, 106].map((y, i) => (
                        <g key={y} className="gkf-row" style={delay(i * 0.35)}>
                            <Line x={84} y={y} w={[70, 58, 76, 64][i]!} h={6} o={0.18} />
                            {i === 2
                                ? <circle className="gkf-tick" style={{ ...delay(i * 0.35 + 0.25), color: GOLD }} cx="226" cy={y + 3} r="4" fill="currentColor" />
                                : <Tick x={220} y={y + 3} at={i * 0.35 + 0.25} />}
                        </g>
                    ))}
                    <Line x={84} y={126} w={152} h={3} o={0.08} />
                    <rect className="gkf-bar" x="84" y="126" width="152" height="3" rx="1.5" fill="currentColor" opacity="0.45" />
                </>
            )
        case "report":
            return (
                <>
                    <rect {...S2} x="96" y="16" width="128" height="130" rx="8" />
                    <Line x={110} y={30} w={60} h={7} o={0.2} />
                    {[[52, 100], [66, 86], [80, 94]].map(([y, w], i) => (
                        <g key={y}>
                            <Line x={110} y={y!} w={w!} o={0.08} />
                            <rect className="gkf-bar" style={delay(i * 0.2)} x="110" y={y} width={w} height="4" rx="2" fill="currentColor" opacity="0.35" />
                        </g>
                    ))}
                    {/* A small bar chart pops on, the newest bar in amber. */}
                    <g className="gkf-tick" style={delay(1.6)}>
                        <path {...S2} opacity="0.32" d="M110 130 H206" />
                        <rect x="114" y="116" width="10" height="14" rx="2" fill="currentColor" opacity="0.25" />
                        <rect x="130" y="108" width="10" height="22" rx="2" fill="currentColor" opacity="0.25" />
                        <rect x="146" y="112" width="10" height="18" rx="2" fill="currentColor" opacity="0.25" />
                        <rect x="162" y="100" width="10" height="30" rx="2" fill={GOLD} opacity="0.85" />
                    </g>
                </>
            )
        case "files":
            return (
                <>
                    {/* The folder: back flap, then files drop in, then the front. */}
                    <path {...S2} d="M84 52 H134 L146 64 H236 V138 H84 Z" />
                    <g>
                        {[[104, 0], [140, 0.35], [176, 0.7]].map(([x, at], i) => (
                            <g key={x} className="gkf-cell" style={delay(at!)}>
                                <path {...S2} className="fill-white dark:fill-neutral-900" stroke={i === 2 ? GOLD : "currentColor"} d={`M${x} 40 H${x! + 28} L${x! + 38} 50 V96 H${x} Z`} />
                                <Line x={x! + 6} y={60} w={22} h={3} o={0.25} />
                                <Line x={x! + 6} y={68} w={18} h={3} o={0.15} />
                            </g>
                        ))}
                    </g>
                    <path {...S3} className="fill-white dark:fill-neutral-900" d="M80 84 H240 L232 138 H88 Z" />
                    <Line x={96} y={120} w={128} h={3} o={0.08} />
                    <rect className="gkf-bar" x="96" y="120" width="128" height="3" rx="1.5" fill="currentColor" opacity="0.45" />
                </>
            )
        case "ai":
            return (
                <>
                    <g className="gkf-bars" fill="currentColor">
                        <rect x="96" y="62" width="6" height="36" rx="3" />
                        <rect x="108" y="54" width="6" height="52" rx="3" style={delay(0.15)} />
                        <rect x="120" y="62" width="6" height="36" rx="3" style={delay(0.3)} />
                    </g>
                    <rect {...S2} x="168" y="22" width="96" height="118" rx="8" />
                    {[34, 68, 102].map((y, i) => (
                        <g key={y} className="gkf-card" style={delay(i * 0.35)}>
                            <rect className="fill-white dark:fill-neutral-900" x="178" y={y} width="76" height="26" rx="5" stroke={i === 2 ? GOLD : "currentColor"} strokeOpacity={i === 2 ? 0.9 : 0.25} />
                            <Line x={186} y={y + 8} w={[40, 34, 44][i]!} o={0.25} />
                            <Line x={186} y={y + 16} w={[56, 50, 30][i]!} h={3} />
                        </g>
                    ))}
                </>
            )
        default:
            return (
                <>
                    <path {...S3} d="M160 40 C 136 30, 104 30, 84 38 V128 C 104 120, 136 120, 160 130 C 184 120, 216 120, 236 128 V38 C 216 30, 184 30, 160 40 Z" />
                    <path {...S2} d="M160 40 V130" />
                    <g className="gkf-leaf">
                        <path {...S2} className="fill-white dark:fill-neutral-900" d="M160 42 C 180 34, 208 34, 228 40 V124 C 208 118, 180 118, 160 126 Z" />
                    </g>
                    <path {...S2} opacity="0.32" d="M98 60 H146 M98 74 H140 M98 88 H144" />
                </>
            )
    }
}

export function FlowLoader({
    kind = "page",
    label,
    fullScreen = true,
    showCaption = true,
    className = "",
}: {
    kind?: FlowLoaderKind
    /** The caption under the scene; defaults to the kind's own ("Opening the page"). */
    label?: string
    /** Cover the viewport (default); false fills its parent. */
    fullScreen?: boolean
    /** False for a bare scene (no caption). */
    showCaption?: boolean
    className?: string
}) {
    const caption = label ?? CAPTION[kind]
    return (
        <div
            role="status"
            aria-live="polite"
            className={cn(
                "flex w-full flex-col items-center justify-center bg-white px-4 text-neutral-900 dark:bg-[#121314] dark:text-neutral-100",
                fullScreen ? "fixed inset-0 z-[100]" : "relative min-h-[50dvh] py-12",
                className,
            )}
        >
            <style>{STYLES}</style>
            <svg
                viewBox="0 0 320 160"
                aria-hidden
                className={cn("h-auto w-full", fullScreen ? "max-w-[300px] sm:max-w-[420px] lg:max-w-[480px]" : "max-w-[300px] sm:max-w-[360px]")}
            >
                <Scene kind={kind} />
            </svg>
            {showCaption ? <p className="mt-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">{caption}</p> : <span className="sr-only">{caption}</span>}
        </div>
    )
}

export default FlowLoader
