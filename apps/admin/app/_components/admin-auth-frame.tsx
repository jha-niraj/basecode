"use client"

import { AuthFrame } from "@repo/auth/ui"
import { ADMIN_POINTS } from "@/lib/admin-auth-points"

/**
 * The auth frame as admin uses it. A client component on purpose: the panel's points carry icon COMPONENTS, and a
 * function cannot be passed from a server page into a client component - so the points are imported here, not passed.
 */
export function AdminAuthFrame({ panelTitle, panelLine, children }: {
    panelTitle: string
    panelLine: string
    children: React.ReactNode
}) {
    return (
        <AuthFrame eyebrow="Admin" legal={null} points={ADMIN_POINTS} panelTitle={panelTitle} panelLine={panelLine}>
            {children}
        </AuthFrame>
    )
}
