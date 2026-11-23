"use client"

import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

/**
 * The scene behind `SigningInScreen` and `SigningOutScreen`: an open door, and a small arrow that walks IN through it
 * (arriving) or OUT of it (leaving). Same line-art family as the status screens and flow loaders: neutral strokes in
 * `currentColor`, amber on the one mark, transform/opacity only, still under `prefers-reduced-motion`.
 */
export type SessionMode = "arriving" | "leaving"

const STYLES = `
.ss-walk-in { animation: ss-walk-in 2.4s cubic-bezier(.45,0,.2,1) infinite; }
@keyframes ss-walk-in { 0% { transform: translateX(-70px); opacity: 0; } 20% { opacity: 1; } 62%,80% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(0); opacity: 0; } }
.ss-walk-out { animation: ss-walk-out 2.4s cubic-bezier(.45,0,.2,1) infinite; }
@keyframes ss-walk-out { 0%,10% { transform: translateX(0); opacity: 0; } 25% { opacity: 1; } 75% { opacity: 1; } 100% { transform: translateX(80px); opacity: 0; } }
.ss-door { transform-box: fill-box; transform-origin: 0% 50%; animation: ss-door 2.4s ease-in-out infinite; }
@keyframes ss-door { 0%,100% { transform: scaleX(1); } 40%,70% { transform: scaleX(.55); } }
.ss-dots span { animation: ss-dot 1.2s ease-in-out infinite; opacity: .2; }
.ss-dots span:nth-child(2) { animation-delay: .2s; } .ss-dots span:nth-child(3) { animation-delay: .4s; }
@keyframes ss-dot { 0%,100% { opacity: .2; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
    .ss-walk-in, .ss-walk-out, .ss-door, .ss-dots span { animation: none !important; opacity: 1 !important; }
}
`

const S = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
const AMBER = "text-amber-700 dark:text-amber-400"

export function SessionScene({ mode, className }: { mode: SessionMode; className?: string }) {
    return (
        <svg viewBox="0 0 320 160" aria-hidden className={cn("w-full max-w-[300px] text-neutral-900 dark:text-neutral-100", className)}>
            <style>{STYLES}</style>
            {/* The door frame, the floor, and the door leaf swinging open. */}
            <path {...S} d="M150 136 V28 H212 V136" />
            <path {...S} strokeWidth={2} opacity="0.32" d="M60 136 H260" />
            <path {...S} strokeWidth={2} className="ss-door fill-white dark:fill-[#121314]" d="M150 30 L196 40 V128 L150 136 Z" />
            <g className={cn(mode === "arriving" ? "ss-walk-in" : "ss-walk-out", AMBER)}>
                {mode === "arriving"
                    ? <path {...S} d="M110 86 H150 M136 72 L150 86 L136 100" />
                    : <path {...S} d="M190 86 H230 M216 72 L230 86 L216 100" />}
            </g>
        </svg>
    )
}

export function SessionScreen({ mode, title, note, children, fullScreen = true, className }: {
    mode: SessionMode
    title?: string
    note?: string
    children?: ReactNode
    fullScreen?: boolean
    className?: string
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={title ?? "Loading"}
            className={cn(
                fullScreen ? "fixed inset-0 z-[100]" : "relative w-full py-12",
                "flex items-center justify-center bg-white px-4 text-neutral-900 dark:bg-[#121314] dark:text-neutral-100",
                className,
            )}
        >
            <div className="flex w-full max-w-lg flex-col items-center text-center">
                <SessionScene mode={mode} />
                {children}
                {title && (
                    <p className="mt-6 text-xl font-semibold tracking-tight">
                        {title}<span className="ss-dots" aria-hidden><span>.</span><span>.</span><span>.</span></span>
                    </p>
                )}
                {note && <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">{note}</p>}
            </div>
        </div>
    )
}

export default SessionScreen
