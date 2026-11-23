import { AppLoader } from "@repo/ui/components/ui/app-loader"

/** Fallback for a route without its own loading.tsx. Every page should have its own, drawn to its layout. */
export default function Loading() {
    return <AppLoader fullScreen={false} />
}
