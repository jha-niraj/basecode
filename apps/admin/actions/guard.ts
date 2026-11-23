import "server-only"

import { AppError } from "@repo/errors"
import { getAdmin, type CurrentAdmin } from "@/lib/admin-session"
import { adminCan, type AdminPermission, type PermissionLevel } from "@/lib/permissions"

/**
 * The guard every admin server action runs first. Not a 'use server' file (a guard there would be a public
 * endpoint). THROWS AppError - the action catches it and returns `{ success: false, error }`.
 *
 * `module` omitted = any active admin (personal things: their own notifications).
 */
export async function requireAdminAction(module?: AdminPermission, level: PermissionLevel = "read"): Promise<CurrentAdmin> {
    const admin = await getAdmin()
    if (!admin) throw new AppError("auth", "Your session has ended. Sign in again.")
    if (admin.status !== "ACTIVE") throw new AppError("forbidden", "Your admin access is not active.")
    if (module && !adminCan(admin, module, level)) throw new AppError("forbidden", "You don't have permission to do that.")
    return admin
}

/** The safe sentence for a caught error: an AppError's own message, else the fallback (never a raw DB error). */
export function errorText(err: unknown, fallback: string): string {
    if (err instanceof AppError) return err.message
    console.error(`[admin-action] ${fallback}:`, err)
    return fallback
}
