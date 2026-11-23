"use client"

import * as React from "react"
import { ResponsiveContainer } from "recharts"
import { cn } from "../../lib/utils"

/**
 * A recharts `ResponsiveContainer` that never logs
 *
 *     The width(-1) and height(-1) of chart should be greater than 0, please check
 *     the style of container, or the props width(100%) and height(100%) ...
 *
 * WHY THAT WARNING HAPPENS - it is not a broken container, and adding minWidth /
 * minHeight / aspect (what the message suggests) does not silence it, because none
 * of those feed the check:
 *
 * `ResponsiveContainer` seeds its size state from `initialDimension`, which defaults
 * to `{ width: -1, height: -1 }`, and it measures the real box in an EFFECT. The
 * warning is evaluated during RENDER, so it always sees -1 on the first pass:
 *
 *   - on the server, where effects never run, every single render warns; and
 *   - in the browser, once per chart before the ResizeObserver reports.
 *
 * `calculateChartDimensions` turns a percentage into "whatever the container
 * measured", so `width="100%" height="100%"` gets -1 for BOTH dimensions and trips
 * the check. A numeric `height` avoids it - the warning passes when EITHER dimension
 * is positive - which is why only percentage-sized charts are ever noisy. recharts
 * hard-codes `isDev = true` in its log helper, so this reaches production consoles
 * too, not just `next dev`.
 *
 * THE FIX - measure the box ourselves, and mount the container only once we have a
 * positive size to hand it as `initialDimension`. Its first render is then already
 * correct, so the warning cannot fire and there is no frame of wrongly-scaled chart.
 * Sizing itself is still recharts': it keeps `width="100%" height="100%"` and its own
 * ResizeObserver, including the zero-size/overflow-visible trick that lets a chart
 * shrink. Our observer disconnects as soon as it has an answer.
 *
 * Because the height comes from the DOM, it also cannot drift out of sync with the
 * wrapper's CSS the way a hard-coded `height={240}` next to an `h-[240px]` parent does.
 *
 * USAGE - give the PARENT a height, exactly as before:
 *
 *     <div className="h-[240px] w-full">
 *         <ResponsiveChart>
 *             <BarChart data={data}>...</BarChart>
 *         </ResponsiveChart>
 *     </div>
 */

export interface ResponsiveChartProps {
    children: React.ReactNode
    /** Applied to the measured wrapper, which is `h-full w-full` by default. */
    className?: string
    /** Passed through to recharts - throttles its resize handling. */
    debounce?: number
    /** Rendered while the box is being measured (first paint, or while hidden). */
    fallback?: React.ReactNode
}

// Default debounce: a container resized continuously (dragging the Assistant panel's edge, a
// sidebar animating) otherwise reports a new size every frame, and recharts' ReportChartSize
// effect can loop into "Maximum update depth exceeded" (seen 2026-11-21 on the client project
// overview while resizing the Assistant). 50 ms batches the burst without visible lag.
export function ResponsiveChart({ children, className, debounce = 50, fallback = null }: ResponsiveChartProps) {
    const ref = React.useRef<HTMLDivElement>(null)
    const [initialDimension, setInitialDimension] = React.useState<{ width: number; height: number } | null>(null)

    React.useEffect(() => {
        const el = ref.current
        if (!el) return

        // Keep watching until the box HAS a size: a chart inside a closed accordion,
        // an inactive tab or an off-screen panel measures 0 on mount and only becomes
        // real later. Resolving once and disconnecting hands sizing back to recharts.
        const measure = () => {
            const { width, height } = el.getBoundingClientRect()
            if (width <= 0 || height <= 0) return false
            setInitialDimension({ width: Math.round(width), height: Math.round(height) })
            return true
        }

        if (measure()) return
        if (typeof ResizeObserver === "undefined") return

        const observer = new ResizeObserver(() => { if (measure()) observer.disconnect() })
        observer.observe(el)

        // A box that is laid out but still 0x0 on the frame the observer fires - a
        // container-query breakpoint resolving, a panel finishing its width animation -
        // never fires the observer again, because nothing about the ELEMENT changed
        // afterwards. One deferred re-measure catches that without keeping an observer
        // alive for the life of the chart.
        const raf = requestAnimationFrame(() => { if (measure()) observer.disconnect() })
        return () => { cancelAnimationFrame(raf); observer.disconnect() }
    }, [])

    return (
        <div ref={ref} className={cn("h-full w-full", className)}>
            {initialDimension ? (
                <ResponsiveContainer width="100%" height="100%" initialDimension={initialDimension} debounce={debounce}>
                    {children}
                </ResponsiveContainer>
            ) : (
                fallback
            )}
        </div>
    )
}

export default ResponsiveChart
