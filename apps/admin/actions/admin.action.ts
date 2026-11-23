"use server"

import { db } from "@repo/db"
import {
    user,
    account,
    adminAccess,
    adminInvitation,
    adminAuditLog,
} from "@repo/db/schema"
import { auth } from "@repo/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, count, desc, eq, gte, lte } from "@repo/db"
import { hashPassword, verifyPassword } from "@repo/auth"
import { adminInvitationEmail, sendEmail } from "@repo/email"
import { formatAdminRole, type AdminPermissions } from "@/lib/permissions"
import type { AdminInvitationRow, AdminUser } from "@/types/admin"

// Types
export type AdminRole = "SUPER_ADMIN" | "TEAM_MEMBER"

interface CreateInvitationInput {
    email: string
    name?: string
    adminRole: AdminRole
    permissions?: Record<string, string[]>
}

interface AdminResponse<T = unknown> {
    success: boolean
    data?: T
    error?: string
}

/** The invitation token (it is the /join link's secret): 16 characters from a cryptographic source, never Math.random. */
function generateAccessCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    let code = "ADMIN-"
    for (const b of bytes) code += chars.charAt(b % chars.length)
    return code
}

async function getSession() {
    return auth.api.getSession({ headers: await headers() })
}

type AdminAccessRow = typeof adminAccess.$inferSelect

interface CurrentAdminRecord extends AdminAccessRow {
    role: AdminAccessRow["adminRole"]
    name: string | null
    email: string
    image: string | null
    user: { id: string; name: string; email: string; image: string | null } | undefined
}

/**
 * The guard every action here starts with: a session AND an active admin_access row. NOT exported - an exported
 * function in a 'use server' file is a public endpoint, and nothing outside this file needs it.
 */
async function checkAdminAccess(): Promise<AdminResponse<{ isAdmin: boolean; adminAccess: AdminAccessRow }>> {
    try {
        const session = await getSession()
        if (!session?.user?.id) return { success: false, error: "Not authenticated" }
        const adminAccessRecord = await db.query.adminAccess.findFirst({
            where: (a, { eq }) => eq(a.userId, session.user.id),
        })
        if (!adminAccessRecord || adminAccessRecord.status !== "ACTIVE") return { success: false, error: "Not authorized" }
        return { success: true, data: { isAdmin: true, adminAccess: adminAccessRecord } }
    } catch (error) {
        console.error("Admin access check error:", error)
        return { success: false, error: "Failed to check admin access" }
    }
}

export async function getCurrentAdmin(): Promise<AdminResponse<CurrentAdminRecord>> {
    try {
        const session = await getSession()

        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" }
        }

        const adminAccessRecord = await db.query.adminAccess.findFirst({
            where: (a, { eq }) => eq(a.userId, session.user.id),
        })

        if (!adminAccessRecord) {
            return { success: false, error: "Not an admin" }
        }

        const userRecord = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.id, session.user.id),
            columns: { id: true, name: true, email: true, image: true },
        })

        return {
            success: true,
            data: {
                ...adminAccessRecord,
                role: adminAccessRecord.adminRole,
                name: userRecord?.name ?? null,
                email: userRecord?.email ?? '',
                image: userRecord?.image ?? null,
                user: userRecord,
            },
        }
    } catch (error) {
        console.error("Get current admin error:", error)
        return { success: false, error: "Failed to get admin info" }
    }
}

// Get all admin users - one query (the access rows joined to their users), not one per admin.
export async function getAdminUsers(): Promise<AdminResponse<AdminUser[]>> {
    try {
        const access = await checkAdminAccess()
        if (!access.success) return { success: false, error: access.error }
        const me = access.data?.adminAccess
        if (me?.adminRole !== "SUPER_ADMIN" && !(me?.permissions?.admin_management ?? []).some((l) => l === "read" || l === "full")) {
            return { success: false, error: "You don't have access to the team" }
        }

        const admins = await db.query.adminAccess.findMany({
            with: { user: { columns: { id: true, name: true, email: true, image: true } } },
            orderBy: [desc(adminAccess.createdAt)],
        })

        return {
            success: true,
            data: admins.map((admin): AdminUser => ({
                id: admin.id,
                userId: admin.userId,
                role: admin.adminRole,
                adminRole: admin.adminRole,
                status: admin.status,
                permissions: (admin.permissions ?? {}) as AdminPermissions,
                name: admin.user?.name ?? null,
                email: admin.user?.email ?? "",
                image: admin.user?.image ?? null,
                lastLoginAt: admin.lastLoginAt ?? null,
                loginCount: admin.loginCount ?? 0,
                createdAt: admin.createdAt,
                updatedAt: admin.updatedAt,
                user: admin.user ?? null,
            })),
        }
    } catch (error) {
        console.error("Get admin users error:", error)
        return { success: false, error: "Failed to fetch admin users" }
    }
}

// Create admin invitation
export async function createAdminInvitation(input: CreateInvitationInput): Promise<AdminResponse<AdminInvitationRow & { joinUrl: string }>> {
    try {
        const accessCheck = await checkAdminAccess()
        if (!accessCheck.success) return { success: false, error: accessCheck.error }

        const adminAccessRecord = accessCheck.data?.adminAccess

        if (adminAccessRecord?.adminRole !== "SUPER_ADMIN") {
            return { success: false, error: "Only super admins can create invitations" }
        }

        // Check if email already has admin access
        const existingUser = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.email, input.email),
        })

        if (existingUser) {
            const existingAdmin = await db.query.adminAccess.findFirst({
                where: (a, { eq }) => eq(a.userId, existingUser.id),
            })
            if (existingAdmin) {
                return { success: false, error: "User already has admin access" }
            }
        }

        // Check for existing pending invitation
        const existingInvite = await db.query.adminInvitation.findFirst({
            where: (inv, { and, eq }) =>
                and(eq(inv.email, input.email), eq(inv.status, "PENDING")),
        })

        if (existingInvite) {
            return { success: false, error: "Pending invitation already exists for this email" }
        }

        const [invitation] = await db
            .insert(adminInvitation)
            .values({
                email: input.email,
                name: input.name,
                code: generateAccessCode(),
                adminRole: input.adminRole,
                permissions: input.permissions ?? {},
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                createdById: adminAccessRecord!.id,
                createdAt: new Date(),
            })
            .returning()

        await db.insert(adminAuditLog).values({
            adminId: adminAccessRecord!.id,
            action: "CREATE",
            module: "admin_management",
            resourceType: "AdminInvitation",
            resourceId: invitation!.id,
            description: `Created invitation for ${input.email} with role ${input.adminRole}`,
            createdAt: new Date(),
        })

        // The invitation email (agent-neutral @repo/email: no key = skipped and logged, never a crash).
        const base = (process.env.ADMIN_APP_URL ?? "").trim().replace(/\/+$/, "") || "http://localhost:3101"
        const joinUrl = `${base}/join?token=${invitation!.code}`
        const mail = adminInvitationEmail({ name: input.name, roleLabel: formatAdminRole(input.adminRole), url: joinUrl })
        const sent = await sendEmail({ kind: "transactional", to: input.email, subject: mail.subject, html: mail.html, text: mail.text })
        if (sent.status === "failed") console.error("[admin-invite] email failed:", sent.error)

        revalidatePath("/admins")
        revalidatePath("/admins")

        const inv = invitation!
        return {
            success: true,
            data: {
                id: inv.id, email: inv.email, name: inv.name ?? null, code: inv.code, adminRole: inv.adminRole,
                status: inv.status, permissions: (inv.permissions ?? {}) as AdminPermissions,
                expiresAt: inv.expiresAt, createdAt: inv.createdAt, joinUrl,
            },
        }
    } catch (error) {
        console.error("Create invitation error:", error)
        return { success: false, error: "Failed to create invitation" }
    }
}

// Get pending invitations
export async function getPendingInvitations(): Promise<AdminResponse<AdminInvitationRow[]>> {
    try {
        const { success, error } = await checkAdminAccess()
        if (!success) return { success: false, error }

        const invitations = await db.query.adminInvitation.findMany({
            where: (inv, { eq }) => eq(inv.status, "PENDING"),
            orderBy: [desc(adminInvitation.createdAt)],
        })

        return {
            success: true,
            data: invitations.map((inv): AdminInvitationRow => ({
                id: inv.id,
                email: inv.email,
                name: inv.name ?? null,
                code: inv.code,
                adminRole: inv.adminRole,
                status: inv.status,
                permissions: (inv.permissions ?? {}) as AdminPermissions,
                expiresAt: inv.expiresAt,
                createdAt: inv.createdAt,
            })),
        }
    } catch (error) {
        console.error("Get invitations error:", error)
        return { success: false, error: "Failed to fetch invitations" }
    }
}

// Revoke invitation
export async function revokeInvitation(invitationId: string): Promise<AdminResponse> {
    try {
        const accessCheck = await checkAdminAccess()
        if (!accessCheck.success) return { success: false, error: accessCheck.error }

        const adminAccessRecord = accessCheck.data?.adminAccess

        if (adminAccessRecord?.adminRole !== "SUPER_ADMIN") {
            return { success: false, error: "Only super admins can revoke invitations" }
        }

        await db
            .update(adminInvitation)
            .set({ status: "REVOKED" })
            .where(eq(adminInvitation.id, invitationId))

        await db.insert(adminAuditLog).values({
            adminId: adminAccessRecord.id,
            action: "DELETE",
            module: "admin_management",
            resourceType: "AdminInvitation",
            resourceId: invitationId,
            description: "Revoked admin invitation",
            createdAt: new Date(),
        })

        revalidatePath("/admins")

        return { success: true }
    } catch (error) {
        console.error("Revoke invitation error:", error)
        return { success: false, error: "Failed to revoke invitation" }
    }
}

// Update admin status
export async function updateAdminStatus(
    adminId: string,
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
): Promise<AdminResponse> {
    try {
        const accessCheck = await checkAdminAccess()
        if (!accessCheck.success) return { success: false, error: accessCheck.error }

        const adminAccessRecord = accessCheck.data?.adminAccess

        if (adminAccessRecord?.adminRole !== "SUPER_ADMIN") {
            return { success: false, error: "Only super admins can update admin status" }
        }

        await db
            .update(adminAccess)
            .set({ status, updatedAt: new Date() })
            .where(eq(adminAccess.id, adminId))

        await db.insert(adminAuditLog).values({
            adminId: adminAccessRecord.id,
            action: "UPDATE",
            module: "admin_management",
            resourceType: "AdminAccess",
            resourceId: adminId,
            description: `Updated admin status to ${status}`,
            createdAt: new Date(),
        })

        revalidatePath("/admins")

        return { success: true }
    } catch (error) {
        console.error("Update admin status error:", error)
        return { success: false, error: "Failed to update admin status" }
    }
}

// Update admin permissions
export async function updateAdminPermissions(
    adminId: string,
    permissions: Record<string, string[]>,
): Promise<AdminResponse> {
    try {
        const accessCheck = await checkAdminAccess()
        if (!accessCheck.success) return { success: false, error: accessCheck.error }

        const adminAccessRecord = accessCheck.data?.adminAccess

        if (adminAccessRecord?.adminRole !== "SUPER_ADMIN") {
            return { success: false, error: "Only super admins can update permissions" }
        }

        const previousAdmin = await db.query.adminAccess.findFirst({
            where: (a, { eq }) => eq(a.id, adminId),
        })

        await db
            .update(adminAccess)
            .set({ permissions, updatedAt: new Date() })
            .where(eq(adminAccess.id, adminId))

        await db.insert(adminAuditLog).values({
            adminId: adminAccessRecord.id,
            action: "UPDATE",
            module: "admin_management",
            resourceType: "AdminAccess",
            resourceId: adminId,
            description: "Updated admin permissions",
            changes: { before: previousAdmin?.permissions, after: permissions },
            createdAt: new Date(),
        })

        revalidatePath("/admins")

        return { success: true }
    } catch (error) {
        console.error("Update admin permissions error:", error)
        return { success: false, error: "Failed to update permissions" }
    }
}

// Get dashboard stats
export interface DashboardStats {
    totalUsers: number
    newUsersThisMonth: number
    activeToday: number
    totalAdmins: number
    totalCredits: number
    growthRate: number
}

// Change password with current password verification
export async function changeAdminPassword(
    currentPassword: string,
    newPassword: string,
): Promise<AdminResponse> {
    try {
        const session = await getSession()
        if (!session?.user?.id) {
            return { success: false, error: "Not authenticated" }
        }

        const credentialAccount = await db.query.account.findFirst({
            where: (a, { and, eq }) =>
                and(eq(a.userId, session.user.id), eq(a.providerId, "credential")),
        })

        if (!credentialAccount?.password) {
            return { success: false, error: "No password set for this account" }
        }

        const valid = await verifyPassword(credentialAccount.password, currentPassword)
        if (!valid) {
            return { success: false, error: "Current password is incorrect" }
        }

        const hashedNew = await hashPassword(newPassword)

        await db
            .update(account)
            .set({ password: hashedNew, updatedAt: new Date() })
            .where(eq(account.id, credentialAccount.id))

        const adminAccessRecord = await db.query.adminAccess.findFirst({
            where: (a, { eq }) => eq(a.userId, session.user.id),
        })

        if (adminAccessRecord) {
            await db.insert(adminAuditLog).values({
                adminId: adminAccessRecord.id,
                action: "UPDATE",
                module: "admin_management",
                resourceType: "User",
                resourceId: session.user.id,
                description: "Changed password",
                createdAt: new Date(),
            })
        }

        return { success: true }
    } catch (error) {
        console.error("Change password error:", error)
        return { success: false, error: "Failed to change password" }
    }
}

// Look up a pending invitation by token (for the join page)
export async function getInvitationByToken(token: string): Promise<AdminResponse<{
    email: string
    adminRole: string
    name: string | null
}>> {
    try {
        const invitation = await db.query.adminInvitation.findFirst({
            where: (inv, { and, eq }) =>
                and(eq(inv.code, token.toUpperCase()), eq(inv.status, "PENDING")),
        })

        if (!invitation) return { success: false, error: "Invalid or already used invitation link" }

        if (new Date() > invitation.expiresAt) {
            await db
                .update(adminInvitation)
                .set({ status: "EXPIRED" })
                .where(eq(adminInvitation.id, invitation.id))
            return { success: false, error: "This invitation has expired" }
        }

        return {
            success: true,
            data: {
                email: invitation.email,
                adminRole: invitation.adminRole,
                name: invitation.name ?? null,
            },
        }
    } catch (error) {
        console.error("Get invitation by token error:", error)
        return { success: false, error: "Failed to verify invitation" }
    }
}

// Accept an invitation - creates user + admin access with chosen password
export async function joinAdminInvitation(
    token: string,
    password: string,
): Promise<AdminResponse<{ email: string; passwordKept: boolean }>> {
    try {
        const normalizedCode = token.toUpperCase()

        const invitation = await db.query.adminInvitation.findFirst({
            where: (inv, { and, eq }) =>
                and(eq(inv.code, normalizedCode), eq(inv.status, "PENDING")),
        })

        if (!invitation) return { success: false, error: "Invalid or already used invitation link" }

        if (new Date() > invitation.expiresAt) {
            await db
                .update(adminInvitation)
                .set({ status: "EXPIRED" })
                .where(eq(adminInvitation.id, invitation.id))
            return { success: false, error: "This invitation has expired" }
        }

        const hashedPassword = await hashPassword(password)
        const normalizedEmail = invitation.email.toLowerCase()

        // Create or reuse user
        let existingUser = await db.query.user.findFirst({
            where: (u, { eq }) => eq(u.email, normalizedEmail),
        })

        if (!existingUser) {
            const [newUser] = await db
                .insert(user)
                .values({
                    id: crypto.randomUUID(),
                    email: normalizedEmail,
                    name: invitation.name || normalizedEmail.split("@")[0]!,
                    emailVerified: true,
                    // Console access lives in admin_access, not user.role: role ADMIN would also give this person
                    // platform-wide reads in the main app (every user, every file). Granted only on purpose (seed).
                    role: "USER",
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })
                .returning()
            existingUser = newUser!
        }

        // Create credential account (skip if already exists)
        const existingAccount = await db.query.account.findFirst({
            where: (a, { and, eq }) =>
                and(eq(a.userId, existingUser!.id), eq(a.providerId, "credential")),
        })

        // An account that already has a password keeps it: the typed one is NOT applied (overwriting a password from an
        // invitation link would let a leaked link take the account over). The page then says to use the old one.
        // A Google-only account gets the typed password - the invitation was emailed, which proves the inbox is theirs.
        const passwordKept = Boolean(existingAccount)
        if (!existingAccount) {
            await db.insert(account).values({
                id: crypto.randomUUID(),
                accountId: existingUser.id,
                providerId: "credential",
                userId: existingUser.id,
                password: hashedPassword,
                createdAt: new Date(),
                updatedAt: new Date(),
            })
        }

        // Create adminAccess (skip if already exists)
        const existingAccess = await db.query.adminAccess.findFirst({
            where: (a, { eq }) => eq(a.userId, existingUser!.id),
        })

        let adminAccessRecord = existingAccess

        if (!existingAccess) {
            const [newAccess] = await db
                .insert(adminAccess)
                .values({
                    userId: existingUser.id,
                    adminRole: invitation.adminRole,
                    status: "ACTIVE",
                    permissions: invitation.permissions ?? {},
                    inviteCode: normalizedCode,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                })
                .returning()
            adminAccessRecord = newAccess!
        }

        // Mark invitation used
        await db
            .update(adminInvitation)
            .set({ status: "USED", usedBy: existingUser.id, usedAt: new Date() })
            .where(eq(adminInvitation.id, invitation.id))

        // Audit log
        if (adminAccessRecord) {
            await db.insert(adminAuditLog).values({
                adminId: adminAccessRecord.id,
                action: "LOGIN",
                module: "admin_management",
                resourceType: "AdminAccess",
                resourceId: adminAccessRecord.id,
                description: `${normalizedEmail} joined via invitation link`,
                createdAt: new Date(),
            })
        }

        return { success: true, data: { email: normalizedEmail, passwordKept } }
    } catch (error) {
        console.error("Join admin invitation error:", error)
        return { success: false, error: "Failed to process invitation" }
    }
}

// ─── Types for audit log with admin info ─────────────────────────────────────

export interface AuditLogWithAdmin {
    id: string
    action: string
    module: string
    resourceType: string | null
    resourceId: string | null
    description: string | null
    adminId: string
    metadata: Record<string, unknown> | null
    changes: Record<string, unknown> | null
    ipAddress: string | null
    createdAt: Date | string
    adminRole?: string
    adminUser?: { name: string | null; email: string | null } | null
}

export interface AdminListItem {
    id: string
    name: string | null
    email: string | null
}

// Get audit logs with filters (date range, module, adminId)
export async function getAuditLogsFiltered(params: {
    from?: Date
    to?: Date
    limit?: number
    module?: string
    adminId?: string
}): Promise<AdminResponse<{ logs: AuditLogWithAdmin[]; total: number }>> {
    try {
        const { success, error } = await checkAdminAccess()
        if (!success) return { success: false, error }

        const conditions = []
        if (params.from) conditions.push(gte(adminAuditLog.createdAt, params.from))
        if (params.to) conditions.push(lte(adminAuditLog.createdAt, params.to))
        if (params.module) conditions.push(eq(adminAuditLog.module, params.module))
        if (params.adminId) conditions.push(eq(adminAuditLog.adminId, params.adminId))

        const where = conditions.length > 0 ? and(...conditions) : undefined
        const limit = params.limit ?? 100

        const [rawLogs, [totalResult]] = await Promise.all([
            db.query.adminAuditLog.findMany({
                limit,
                where,
                orderBy: [desc(adminAuditLog.createdAt)],
                with: { admin: { columns: { userId: true, adminRole: true } } },
            }),
            db.select({ count: count() }).from(adminAuditLog).where(where),
        ])

        const ids = Array.from(new Set(rawLogs.map((l) => l.admin.userId)))
        const users = ids.length
            ? await db.query.user.findMany({
                where: (u, { inArray }) => inArray(u.id, ids),
                columns: { id: true, name: true, email: true },
            })
            : []
        const byId = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]))
        const logs: AuditLogWithAdmin[] = rawLogs.map((log) => ({
            ...log,
            metadata: (log.metadata ?? null) as Record<string, unknown> | null,
            changes: (log.changes ?? null) as Record<string, unknown> | null,
            adminRole: log.admin.adminRole,
            adminUser: byId.get(log.admin.userId) ?? null,
        }))

        return {
            success: true,
            data: { logs, total: totalResult?.count ?? 0 },
        }
    } catch (error) {
        console.error("Get filtered audit logs error:", error)
        return { success: false, error: "Failed to fetch audit logs" }
    }
}

// Get admin list for filter dropdown
export async function getAdminList(): Promise<AdminResponse<AdminListItem[]>> {
    try {
        const { success, error } = await checkAdminAccess()
        if (!success) return { success: false, error }

        const records = await db.query.adminAccess.findMany({
            with: { user: { columns: { id: true, name: true, email: true } } },
        })

        return {
            success: true,
            data: records.map((r) => ({
                id: r.id,
                name: r.user?.name ?? null,
                email: r.user?.email ?? null,
            })),
        }
    } catch (error) {
        console.error("Get admin list error:", error)
        return { success: false, error: "Failed to fetch admin list" }
    }
}

