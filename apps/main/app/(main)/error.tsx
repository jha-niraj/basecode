"use client"

import { AppErrorView } from "@repo/ui/components/ui/app-error-view"

/** Inside the shell: the plug scene, a transient blip retried once by itself (classifyError). */
export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
    return <AppErrorView {...props} />
}
