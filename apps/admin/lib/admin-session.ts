import "server-only"

import { cache } from "react"
import { redirect } from "next/navigation"
import { getSession } from "@repo/auth/next"
import { db } from "@repo/db"
import { adminCan, type AdminPermission, type AdminPermissions, type AdminRole, type PermissionLevel } from "./permissions"
import { ROUTES } from "./navigation"

/**
 * The signed-in admin, read once per request (React `cache`). Server only - pages, layouts and server actions call
 * it; a client reads it from `useAdminAccess()` (seeded by the layout, no fetch).
 */
export interface CurrentAdmin {
    /** admin_access row id */
    id: string
    userId: string
    role: AdminRole
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED"
    permissions: AdminPermissions
    name: string
    email: string
    image: string | null
}

export const getAdmin = cache(async (): Promise<CurrentAdmin | null> => {
    const session = await getSession()
    if (!session?.user?.id) return null
    const row = await db.query.adminAccess.findFirst({
        where: (a, { eq }) => eq(a.userId, session.user.id),
    })
    if (!row) return null
    return {
        id: row.id,
        userId: row.userId,
        role: row.adminRole,
        status: row.status,
        permissions: (row.permissions ?? {}) as AdminPermissions,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
    }
})

/**
 * The active admin, else back to sign-in with the reason in the URL. `?stale=1` (no session) and `?denied=1` (signed in,
 * but no active admin access) both make the middleware expire the session cookie: a bare redirect to `/` looped, because
 * the middleware sends any signed-in visitor on `/` to /home, and /home sent them back (found 2026-11-23).
 */
export async function requireActiveAdmin(): Promise<CurrentAdmin> {
    const session = await getSession()
    if (!session) redirect(`${ROUTES.signIn}?stale=1`)
    const admin = await getAdmin()
    if (!admin || admin.status !== "ACTIVE") redirect(`${ROUTES.signIn}?denied=1`)
    return admin
}

/**
 * For a page: the active admin, else to sign-in; with a module, the admin must hold it, else the 403 screen.
 * Every page calls this itself - the layout's check is not enough once a page moves out of the group.
 */
export async function requireAdminPage(module?: AdminPermission, level: PermissionLevel = "read"): Promise<CurrentAdmin> {
    const admin = await requireActiveAdmin()
    if (module && !adminCan(admin, module, level)) redirect(ROUTES.accessDenied)
    return admin
}
