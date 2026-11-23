"use server"

import { and, count, desc, eq, sql } from "@repo/db"
import { db } from "@repo/db"
import { adminAccess, adminNotification } from "@repo/db/schema"
import { fail, failWith, ok, type ActionResult } from "@repo/errors"
import { getAdmin } from "@/lib/admin-session"

/**
 * ONLY what the console shell needs (the bell and the last-sign-in stamp). The shell sits in the shared layout, and a
 * 'use server' file registers every export on every route whose tree imports it - so the layout imports this small
 * file, never the big admin / system action files. Every export checks the admin itself.
 */
export type ShellNotification = {
    id: string
    title: string
    message: string
    type: string
    actionUrl: string | null
    isRead: boolean
    readAt: Date | null
    createdAt: Date
}

const SIGNED_OUT = "Your session has ended. Sign in again."

export async function getShellUnreadCount(): Promise<ActionResult<number>> {
    const admin = await getAdmin()
    if (!admin || admin.status !== "ACTIVE") return failWith("auth", SIGNED_OUT)
    try {
        const [row] = await db.select({ value: count() }).from(adminNotification)
            .where(and(eq(adminNotification.adminId, admin.id), eq(adminNotification.isRead, false)))
        return ok(row?.value ?? 0)
    } catch (err) {
        return fail(err, "shell.unread")
    }
}

export async function getShellNotifications(limit = 30): Promise<ActionResult<ShellNotification[]>> {
    const admin = await getAdmin()
    if (!admin || admin.status !== "ACTIVE") return failWith("auth", SIGNED_OUT)
    try {
        const rows = await db.select({
            id: adminNotification.id,
            title: adminNotification.title,
            message: adminNotification.message,
            type: adminNotification.type,
            actionUrl: adminNotification.actionUrl,
            isRead: adminNotification.isRead,
            readAt: adminNotification.readAt,
            createdAt: adminNotification.createdAt,
        }).from(adminNotification)
            .where(eq(adminNotification.adminId, admin.id))
            .orderBy(desc(adminNotification.createdAt))
            .limit(Math.min(Math.max(1, limit), 100))
        return ok(rows)
    } catch (err) {
        return fail(err, "shell.notifications")
    }
}

export async function markShellNotificationRead(id: string): Promise<ActionResult<null>> {
    const admin = await getAdmin()
    if (!admin || admin.status !== "ACTIVE") return failWith("auth", SIGNED_OUT)
    try {
        await db.update(adminNotification)
            .set({ isRead: true, readAt: new Date() })
            .where(and(eq(adminNotification.id, id), eq(adminNotification.adminId, admin.id)))
        return ok(null)
    } catch (err) {
        return fail(err, "shell.read")
    }
}

export async function markAllShellNotificationsRead(): Promise<ActionResult<null>> {
    const admin = await getAdmin()
    if (!admin || admin.status !== "ACTIVE") return failWith("auth", SIGNED_OUT)
    try {
        await db.update(adminNotification)
            .set({ isRead: true, readAt: new Date() })
            .where(and(eq(adminNotification.adminId, admin.id), eq(adminNotification.isRead, false)))
        return ok(null)
    } catch (err) {
        return fail(err, "shell.readAll")
    }
}

/** Stamps the last sign-in once per browser session (the shell calls it once; a write, never part of a render). */
export async function stampShellSignIn(): Promise<ActionResult<null>> {
    const admin = await getAdmin()
    if (!admin || admin.status !== "ACTIVE") return failWith("auth", SIGNED_OUT)
    try {
        await db.update(adminAccess)
            .set({ lastLoginAt: new Date(), loginCount: sql`${adminAccess.loginCount} + 1` })
            .where(eq(adminAccess.id, admin.id))
        return ok(null)
    } catch (err) {
        return fail(err, "shell.stamp")
    }
}
