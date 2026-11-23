import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * An icon + text note ("Graded against the official answer...", "Law context was unavailable...").
 *
 * An end-to-end finding: these were hand-written as
 * `flex items-center justify-center text-center`, so once the text wrapped to two lines the icon
 * floated in the vertical middle of the paragraph and every line was centred - it read as a
 * caption, not a note. The rule is: the icon sits on the FIRST line (`items-start` plus a small
 * top offset that lines the glyph up with the text's cap height) and the text is left-aligned.
 *
 * `tone` only tints; the layout is the point. Any lucide icon (or the product's AI mark) works -
 * it is sized here, whatever size the caller passed.
 */
export function InlineNote({
    icon,
    children,
    tone = "muted",
    className,
}: {
    icon?: React.ReactNode
    children: React.ReactNode
    tone?: "muted" | "warning" | "danger"
    className?: string
}) {
    return (
        <div
            className={cn(
                "flex items-start gap-2 text-left text-[12.5px] leading-relaxed",
                tone === "muted" && "text-neutral-600 dark:text-neutral-400",
                tone === "warning" && "text-amber-800 dark:text-amber-300",
                tone === "danger" && "text-red-700 dark:text-red-400",
                className,
            )}
        >
            {icon ? (
                // 3px = (20px line box at 12.5px x leading-relaxed - 14px glyph) / 2: the glyph
                // centres on line ONE, not on the paragraph.
                <span aria-hidden className="mt-[3px] flex shrink-0 [&_svg]:size-3.5!">{icon}</span>
            ) : null}
            <div className="min-w-0 flex-1">{children}</div>
        </div>
    )
}
