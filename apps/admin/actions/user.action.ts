"use server"

import { revalidatePath } from "next/cache"
import { db, and, count, desc, eq, gte, ilike, inArray, or } from "@repo/db"
import { adminAuditLog, user } from "@repo/db/schema"
import { getAdmin } from "@/lib/admin-session"
import { adminCan, type PermissionLevel } from "@/lib/permissions"
import type { UserFilters, UserListPage, UserRow, UserStats, UserDetail } from "@/types/admin"

interface Response<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

/** Every export checks the session and the `users` permission itself (the layout's check is not enough). */
async function requireUsers(level: PermissionLevel) {
    const admin = await getAdmin()
    if (!admin || admin.status !== "ACTIVE") return { admin: null, error: "Not authenticated" }
    if (!adminCan(admin, "users", level)) return { admin: null, error: "You don't have access to users" }
    return { admin, error: null }
}

const ROW_COLUMNS = {
    id: true, name: true, email: true, image: true, role: true, isActive: true, emailVerified: true, createdAt: true,
} as const

export async function getUsers(
    page = 1,
    limit = 20,
    search = "",
    status?: "active" | "inactive",
    filters?: UserFilters,
): Promise<Response<UserListPage>> {
    try {
        const { admin, error } = await requireUsers("read")
        if (!admin) return { success: false, error: error ?? "Not authenticated" }

        const safeLimit = Math.min(Math.max(1, limit), 100)
        const conditions = []
        const q = search.trim()
        if (q) conditions.push(or(ilike(user.email, `%${q}%`), ilike(user.name, `%${q}%`)))
        if (status === "active") conditions.push(eq(user.isActive, true))
        if (status === "inactive") conditions.push(eq(user.isActive, false))
        if (filters?.roles) {
            if (filters.roles.length === 0) return { success: true, data: { items: [], total: 0, pages: 1 } }
            conditions.push(inArray(user.role, filters.roles))
        }
        if (filters?.active) {
            if (filters.active.length === 0) return { success: true, data: { items: [], total: 0, pages: 1 } }
            if (filters.active.length === 1) conditions.push(eq(user.isActive, filters.active[0]!))
        }
        if (filters?.verified) {
            if (filters.verified.length === 0) return { success: true, data: { items: [], total: 0, pages: 1 } }
            if (filters.verified.length === 1) conditions.push(eq(user.emailVerified, filters.verified[0]!))
        }
        const where = conditions.length > 0 ? and(...conditions) : undefined

        const [items, [totalResult]] = await Promise.all([
            db.query.user.findMany({
                where,
                columns: ROW_COLUMNS,
                orderBy: [desc(user.createdAt)],
                limit: safeLimit,
                offset: (Math.max(1, page) - 1) * safeLimit,
            }),
            db.select({ count: count() }).from(user).where(where),
        ])

        const total = totalResult?.count ?? 0
        return {
            success: true,
            data: { items: items satisfies UserRow[], total, pages: Math.max(1, Math.ceil(total / safeLimit)) },
        }
    } catch (error) {
        console.error("Get users error:", error)
        return { success: false, error: "Failed to fetch users" }
    }
}

/** Headline counts for the users page: all time, plus new in the last 30 days (a named window). */
export async function getUserStats(): Promise<Response<UserStats>> {
    try {
        const { admin, error } = await requireUsers("read")
        if (!admin) return { success: false, error: error ?? "Not authenticated" }

        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const [[total], [active], [verified], [recent]] = await Promise.all([
            db.select({ count: count() }).from(user),
            db.select({ count: count() }).from(user).where(eq(user.isActive, true)),
            db.select({ count: count() }).from(user).where(eq(user.emailVerified, true)),
            db.select({ count: count() }).from(user).where(gte(user.createdAt, since)),
        ])
        const t = total?.count ?? 0
        const a = active?.count ?? 0
        return {
            success: true,
            data: { total: t, active: a, inactive: t - a, verified: verified?.count ?? 0, newLast30: recent?.count ?? 0 },
        }
    } catch (error) {
        console.error("Get user stats error:", error)
        return { success: false, error: "Failed to fetch user stats" }
    }
}

export async function getUserById(userId: string): Promise<Response<UserDetail>> {
    try {
        const { admin, error } = await requireUsers("read")
        if (!admin) return { success: false, error: error ?? "Not authenticated" }

        const record = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.id, userId),
            columns: { ...ROW_COLUMNS, bio: true, updatedAt: true },
            with: { adminAccess: { columns: { adminRole: true, status: true } } },
        })
        if (!record) return { success: false, error: "User not found" }

        const access = record.adminAccess
        return {
            success: true,
            data: {
                ...record,
                adminAccess: access ? { adminRole: access.adminRole, status: access.status } : null,
            },
        }
    } catch (error) {
        console.error("Get user by id error:", error)
        return { success: false, error: "Failed to fetch user" }
    }
}

export async function updateUserStatus(userId: string, isActive: boolean): Promise<Response> {
    try {
        const { admin, error } = await requireUsers("write")
        if (!admin) return { success: false, error: error ?? "Not authenticated" }
        if (admin.userId === userId) return { success: false, error: "You can't change your own account here" }

        await db.update(user).set({ isActive, updatedAt: new Date() }).where(eq(user.id, userId))
        await db.insert(adminAuditLog).values({
            adminId: admin.id,
            action: "UPDATE",
            module: "users",
            resourceType: "User",
            resourceId: userId,
            description: isActive ? "Activated a user" : "Deactivated a user",
            createdAt: new Date(),
        })

        revalidatePath("/users")
        return { success: true }
    } catch (error) {
        console.error("Update user status error:", error)
        return { success: false, error: "Failed to update user status" }
    }
}
