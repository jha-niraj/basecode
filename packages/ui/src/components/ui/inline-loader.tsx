"use client"

import { DotmSquare11 } from "./dotm-square-11"
import { cn } from "../../lib/utils"

/**
 * The busy indicator for anything INLINE - a button the user just clicked, a row being saved, a "refreshing" hint.
 * One component so the whole product says "working" the same way.
 *
 *   inline, in a control the user just clicked      ->  THIS
 *   a region or page whose content has not arrived  ->  a skeleton shaped like it
 *   a whole page / route transition                 ->  <AppLoader />
 *
 * A small dot matrix rather than a rotating icon, in `currentColor`, so it inherits the button's text colour with no
 * per-site colour prop.
 */
export interface InlineLoaderProps {
    /** Box size in px. 16 suits a default button, 14 a small one, 12 a caption. */
    size?: number
    /** Margin/colour utilities only - sizing comes from `size`. */
    className?: string
    /** Announced to screen readers. */
    label?: string
}

export function InlineLoader({ size = 16, className, label = "Loading" }: InlineLoaderProps) {
    return (
        <span role="status" className={cn("inline-flex shrink-0 items-center justify-center", className)}>
            <span className="sr-only">{label}</span>
            <span aria-hidden className="inline-flex">
                <DotmSquare11 size={size} dotSize={Math.max(1.6, size / 7)} />
            </span>
        </span>
    )
}

export default InlineLoader
