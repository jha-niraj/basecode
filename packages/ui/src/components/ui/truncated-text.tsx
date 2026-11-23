"use client"

import * as React from "react"
import { cn } from "../../lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

/**
 * One line of text that is cut with an ellipsis when it does not fit, and shows the full text in a
 * tooltip on hover or keyboard focus - but ONLY when it was actually cut.
 *
 * Built for page-header descriptions (the owner, 2026-11-20: "description on all the screens one liner
 * only"). A two- or three-line description pushes the toolbar and the list down by a different
 * amount on every page, and on a phone it can fill half the first screen. One line keeps every
 * header the same height; the tooltip keeps the full sentence a hover away.
 *
 * How it decides: a ResizeObserver compares `scrollWidth` with `clientWidth`. Text that fits gets
 * no tooltip, no tab stop and no aria-label - it is just a paragraph.
 *
 * Children may be any inline content. The tooltip shows `tooltip` when given, otherwise the
 * children when they are a plain string, otherwise the element's rendered text.
 *
 * TRUNCATION NEEDS A BOUNDED WIDTH. Every flex or grid ancestor between this and the page column
 * must allow shrinking (`min-w-0`), or the line simply overflows its box instead of being cut.
 */
export type TruncatedTextProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> & {
    children: React.ReactNode
    /** The element to render. Defaults to `p`. */
    as?: "p" | "span" | "div"
    /** Tooltip text when the children are not a plain string (or should read differently). */
    tooltip?: string
    /** Classes for the tooltip bubble. */
    tooltipClassName?: string
    side?: "top" | "bottom" | "left" | "right"
}

export function TruncatedText({
    children,
    as = "p",
    tooltip,
    tooltipClassName,
    side = "bottom",
    className,
    ...rest
}: TruncatedTextProps) {
    const [node, setNode] = React.useState<HTMLElement | null>(null)
    const [truncated, setTruncated] = React.useState(false)
    const [renderedText, setRenderedText] = React.useState("")
    const [open, setOpen] = React.useState(false)

    React.useEffect(() => {
        if (!node) return
        const measure = () => {
            // 1px of slack: sub-pixel widths can report scrollWidth one above clientWidth on text
            // that visibly fits.
            const cut = node.scrollWidth - node.clientWidth > 1
            setTruncated(cut)
            if (cut) setRenderedText(node.textContent?.replace(/\s+/g, " ").trim() ?? "")
        }
        measure()
        if (typeof ResizeObserver === "undefined") return
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
    }, [node, children])

    const fullText = tooltip ?? (typeof children === "string" ? children.replace(/\s+/g, " ").trim() : renderedText)
    const showTip = truncated && fullText.length > 0
    const Comp = as

    return (
        <Tooltip open={showTip ? open : false} onOpenChange={setOpen} delayDuration={300}>
            <TooltipTrigger asChild>
                <Comp
                    ref={setNode}
                    {...rest}
                    tabIndex={showTip ? 0 : undefined}
                    aria-label={showTip ? fullText : undefined}
                    className={cn(
                        "block min-w-0 max-w-full truncate",
                        showTip && "cursor-default rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        className,
                    )}
                >
                    {children}
                </Comp>
            </TooltipTrigger>
            {showTip && (
                <TooltipContent
                    side={side}
                    align="start"
                    className={cn("max-w-[min(28rem,calc(100vw-2rem))] whitespace-normal break-words text-xs leading-relaxed", tooltipClassName)}
                >
                    {fullText}
                </TooltipContent>
            )}
        </Tooltip>
    )
}
