"use client"

import { AppErrorView } from "@repo/ui/components/ui/app-error-view"

export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
    return <AppErrorView {...props} />
}
