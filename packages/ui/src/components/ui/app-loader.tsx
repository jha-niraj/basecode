import { FlowLoader, type FlowLoaderKind } from "./flow-loader"

/**
 * The WHOLE-PAGE loader tier (AGENTS.md, loading states): draws the flow-loader family (`flow-loader.tsx`) - the kind
 * of work arriving, a turning page when nothing more specific fits. Pass `kind` where the destination is known.
 * A region with a shape gets its skeleton instead; a control's own action gets `InlineLoader`.
 */
export type AppLoaderProps = {
    /** Cover the viewport (default). Set false to fill a parent instead. */
    fullScreen?: boolean
    /** Optional caption, e.g. "Preparing your workspace"; defaults to the kind's own. */
    label?: string
    /** Which work is arriving; `page` when unknown. */
    kind?: FlowLoaderKind
    className?: string
}

export function AppLoader({ fullScreen = true, label, kind = "page", className = "" }: AppLoaderProps) {
    return <FlowLoader kind={kind} label={label} fullScreen={fullScreen} className={className} />
}

export type { FlowLoaderKind }
export default AppLoader
