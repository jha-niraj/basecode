"use client"

import { AppErrorView } from "@repo/ui/components/ui/app-error-view"

/** Root error boundary: classifyError decides the copy; a transient blip retries once by itself. */
export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
    return <AppErrorView {...props} />
}
