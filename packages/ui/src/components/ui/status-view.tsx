import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

/**
 * THE STATUS SCREENS - 404 / 500 / 403. The drawing says what happened, in generic objects any product can use:
 *
 *   - `not-found` (404): a page drawn as a dashed outline (it is not there) with a magnifier searching for it.
 *   - `error` (500): a plug pulled from its socket, easing back in with a small spark - "reconnecting".
 *   - `forbidden` (403): a padlock whose shackle is tugged and holds.
 *
 * Then the code (mono), the title, one line, the asked-for path, a reference (500), and the actions the app passes
 * in (this package has no routing of its own, so links come from the caller - pass AppLink buttons). Neutral line art
 * in `currentColor`; CSS keyframes on transform/opacity only; under `prefers-reduced-motion` nothing moves.
 */

export type StatusKind = "not-found" | "error" | "forbidden"

const COPY: Record<StatusKind, { code: string; title: string; description: string }> = {
    "not-found": {
        code: "404",
        title: "This page isn't here",
        description: "The link may be old, or the page has moved.",
    },
    error: {
        code: "500",
        title: "Something broke on our side",
        description: "It's not you. We've logged it, and trying again usually sorts it out.",
    },
    forbidden: {
        code: "403",
        title: "You don't have access",
        description: "This page needs a permission you don't have. Ask an admin to give you access if you need it.",
    },
}

const STYLES = `
.sv-plug { animation: sv-plug 3.6s cubic-bezier(.55,0,.25,1) infinite; }
@keyframes sv-plug {
    0%, 10% { transform: translateX(0); }
    42% { transform: translateX(17px); }
    47% { transform: translateX(13px); }
    52% { transform: translateX(17px); }
    80%, 100% { transform: translateX(0); }
}
.sv-zap { opacity: 0; transform-box: fill-box; transform-origin: center; animation: sv-zap 3.6s ease-out infinite; }
@keyframes sv-zap {
    0%, 41% { opacity: 0; transform: scale(.4); }
    45% { opacity: 1; transform: scale(1); }
    50% { opacity: .2; } 53% { opacity: .9; }
    62%, 100% { opacity: 0; transform: scale(1.3); }
}
.sv-lens { animation: sv-lens 4.2s ease-in-out infinite; }
@keyframes sv-lens {
    0%, 100% { transform: translate(0, 0); }
    25% { transform: translate(-34px, -14px); }
    50% { transform: translate(-6px, 16px); }
    75% { transform: translate(-40px, 10px); }
}
.sv-shackle { transform-box: fill-box; transform-origin: 50% 100%; animation: sv-tug 3.2s ease-in-out infinite; }
@keyframes sv-tug {
    0%, 30%, 100% { transform: translateY(0); }
    36% { transform: translateY(-5px); }
    40% { transform: translateY(0); }
    46% { transform: translateY(-4px); }
    50% { transform: translateY(0); }
}
.sv-lockbody { transform-box: fill-box; transform-origin: center; animation: sv-shake 3.2s ease-in-out infinite; }
@keyframes sv-shake {
    0%, 30%, 52%, 100% { transform: rotate(0); }
    36% { transform: rotate(-3deg); } 41% { transform: rotate(2.5deg); } 46% { transform: rotate(-2deg); }
}
@media (prefers-reduced-motion: reduce) {
    .sv-plug, .sv-zap, .sv-lens, .sv-shackle, .sv-lockbody { animation: none !important; }
    .sv-zap { opacity: 0; }
}
`

const STROKE = { stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" }

export function StatusScene({ kind = "not-found", className = "" }: { kind?: StatusKind; className?: string }) {
    return (
        <svg viewBox="0 0 320 160" className={cn("w-full max-w-[300px] text-neutral-900 dark:text-neutral-100", className)} aria-hidden>
            <style>{STYLES}</style>
            {kind === "error" ? (
                <>
                    {/* Socket + its cable (fixed, right). */}
                    <g {...STROKE}>
                        <path d="M292 80 H252" />
                        <rect x="196" y="54" width="56" height="52" rx="12" />
                        <path d="M210 71 H218 M210 89 H218" strokeWidth="4" />
                    </g>
                    {/* Plug + its cable (moves). */}
                    <g className="sv-plug" {...STROKE}>
                        <path d="M28 80 C 60 80, 70 104, 100 96 S 110 80, 118 80" />
                        <rect x="118" y="58" width="42" height="44" rx="10" />
                        <path d="M160 71 H178 M160 89 H178" strokeWidth="4" />
                    </g>
                    {/* The spark in the gap as the plug nearly makes it. */}
                    <g className="sv-zap" {...STROKE} strokeWidth="2">
                        <path d="M190 62 L186 70 L192 72 L187 80" />
                        <path d="M184 92 L190 98" />
                    </g>
                </>
            ) : kind === "forbidden" ? (
                <g {...STROKE}>
                    <path className="sv-shackle" d="M142 74 V58 a18 18 0 0 1 36 0 V74" />
                    <g className="sv-lockbody">
                        <rect x="128" y="74" width="64" height="54" rx="12" />
                        <circle cx="160" cy="96" r="6" />
                        <path d="M160 102 V112" />
                    </g>
                </g>
            ) : (
                <>
                    {/* The page that is not here: a dashed outline. */}
                    <g {...STROKE} strokeDasharray="6 6">
                        <path d="M128 28 H178 L198 48 V132 H128 Z" />
                    </g>
                    <g {...STROKE} strokeOpacity="0.35" strokeWidth="2.5">
                        <path d="M142 66 H182 M142 82 H176 M142 98 H170" />
                    </g>
                    {/* The magnifier searching around it. */}
                    <g className="sv-lens" {...STROKE}>
                        <circle cx="212" cy="96" r="20" className="fill-white dark:fill-[#121314]" />
                        <path d="M227 111 L246 130" strokeWidth="5" />
                    </g>
                </>
            )}
        </svg>
    )
}

export function StatusView({
    kind = "not-found",
    title,
    description,
    requestedPath,
    digest,
    actions,
    children,
    fullScreen = true,
    className,
}: {
    kind?: StatusKind
    title?: string
    description?: string
    /** The path that was asked for, shown small under the copy. */
    requestedPath?: string
    /** A 500's reference (Next's digest), for the person to quote. */
    digest?: string
    /** The buttons - the app's own links and handlers. */
    actions?: ReactNode
    /** Anything under the actions (a search box, a few useful links). */
    children?: ReactNode
    /** Fill the viewport (a standalone page); false to sit inside the shell. */
    fullScreen?: boolean
    className?: string
}) {
    const copy = COPY[kind]
    // A standalone page is the document's <main>; inside the shell (which has its own <main>) it is a plain block.
    const Root = fullScreen ? "main" : "div"
    return (
        <Root
            className={cn(
                "flex w-full items-center justify-center px-4 text-neutral-900 dark:text-white",
                fullScreen ? "min-h-dvh bg-white py-12 dark:bg-[#121314]" : "min-h-[60dvh] py-10",
                className,
            )}
        >
            <div className="flex w-full max-w-lg flex-col items-center text-center">
                <StatusScene kind={kind} />
                <p className="mt-4 font-mono text-xs font-medium tracking-[0.12em] text-neutral-500 dark:text-neutral-400">{copy.code}</p>
                <h1 className="mt-2 text-xl font-semibold tracking-tight">{title ?? copy.title}</h1>
                <p className="mt-2 max-w-md text-sm leading-6 text-neutral-600 dark:text-neutral-400">{description ?? copy.description}</p>
                {requestedPath ? (
                    <p className="mt-3 max-w-full break-all rounded-full bg-neutral-100 px-3 py-1 font-mono text-xs text-neutral-600 dark:bg-neutral-800/70 dark:text-neutral-300">
                        {requestedPath}
                    </p>
                ) : null}
                {digest ? <p className="mt-3 font-mono text-xs text-neutral-500 dark:text-neutral-400">Reference {digest}</p> : null}
                {actions ? <div className="mt-6 flex w-full flex-col items-center justify-center gap-2 sm:w-auto sm:flex-row">{actions}</div> : null}
                {children}
            </div>
        </Root>
    )
}
