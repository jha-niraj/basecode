"use server"

import { and, count, desc, eq } from "@repo/db"
import { db } from "@repo/db"
import { notification } from "@repo/db/schema"
import { getSession } from "@repo/auth/next"
import { fail, failWith, ok, type ActionResult } from "@repo/errors"

/**
 * The signed-in person's notifications (the bell at the foot of the rail). Every export checks the session itself.
 * Creating a notification is NOT here - a 'use server' export is a public endpoint, so `createNotification` lives in
 * `lib/notifications.ts` (server-only) for other server code to call.
 */
export type NotificationRow = typeof notification.$inferSelect

/** One page of the /notifications list. `total` counts the filter's rows; `unread` is always the unread count. */
export interface NotificationPage {
    items: NotificationRow[]
    total: number
    unread: number
    page: number
    pageSize: number
}

const PAGE_SIZE = 20

export async function listNotifications(input: { filter: "all" | "unread"; page: number }): Promise<ActionResult<NotificationPage>> {
    const session = await getSession()
    if (!session) return failWith("auth", "Your session has ended. Sign in again.")
    try {
        const page = Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page)) : 1
        const mine = eq(notification.userId, session.user.id)
        const unreadOnly = and(mine, eq(notification.isRead, false))
        const where = input.filter === "unread" ? unreadOnly : mine
        const [items, [total], [unread]] = await Promise.all([
            db.select().from(notification).where(where)
                .orderBy(desc(notification.createdAt))
                .limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
            db.select({ value: count() }).from(notification).where(where),
            db.select({ value: count() }).from(notification).where(unreadOnly),
        ])
        return ok({ items, total: total?.value ?? 0, unread: unread?.value ?? 0, page, pageSize: PAGE_SIZE })
    } catch (err) {
        return fail(err, "notifications.page")
    }
}

export async function getNotifications(limit = 30): Promise<ActionResult<{ items: NotificationRow[]; unread: number }>> {
    const session = await getSession()
    if (!session) return failWith("auth", "Your session has ended. Sign in again.")
    try {
        const take = Math.min(Math.max(1, limit), 100)
        const [items, [unread]] = await Promise.all([
            db.select().from(notification)
                .where(eq(notification.userId, session.user.id))
                .orderBy(desc(notification.createdAt))
                .limit(take),
            db.select({ value: count() }).from(notification)
                .where(and(eq(notification.userId, session.user.id), eq(notification.isRead, false))),
        ])
        return ok({ items, unread: unread?.value ?? 0 })
    } catch (err) {
        return fail(err, "notifications.list")
    }
}

export async function getUnreadCount(): Promise<ActionResult<number>> {
    const session = await getSession()
    if (!session) return failWith("auth", "Your session has ended. Sign in again.")
    try {
        const [row] = await db.select({ value: count() }).from(notification)
            .where(and(eq(notification.userId, session.user.id), eq(notification.isRead, false)))
        return ok(row?.value ?? 0)
    } catch (err) {
        return fail(err, "notifications.unread")
    }
}

export async function markAsRead(notificationId: string): Promise<ActionResult<null>> {
    const session = await getSession()
    if (!session) return failWith("auth", "Your session has ended. Sign in again.")
    try {
        await db.update(notification)
            .set({ isRead: true, readAt: new Date() })
            .where(and(eq(notification.id, notificationId), eq(notification.userId, session.user.id)))
        return ok(null)
    } catch (err) {
        return fail(err, "notifications.read")
    }
}

export async function markAllAsRead(): Promise<ActionResult<null>> {
    const session = await getSession()
    if (!session) return failWith("auth", "Your session has ended. Sign in again.")
    try {
        await db.update(notification)
            .set({ isRead: true, readAt: new Date() })
            .where(and(eq(notification.userId, session.user.id), eq(notification.isRead, false)))
        return ok(null)
    } catch (err) {
        return fail(err, "notifications.readAll")
    }
}

export async function deleteNotification(notificationId: string): Promise<ActionResult<null>> {
    const session = await getSession()
    if (!session) return failWith("auth", "Your session has ended. Sign in again.")
    try {
        await db.delete(notification)
            .where(and(eq(notification.id, notificationId), eq(notification.userId, session.user.id)))
        return ok(null)
    } catch (err) {
        return fail(err, "notifications.delete")
    }
}
