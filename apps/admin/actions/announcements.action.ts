"use server"

import { revalidatePath } from "next/cache"
import { db } from "@repo/db"
import { adminAuditLog, announcement } from "@repo/db/schema"
import { count, desc, eq } from "@repo/db"
import { errorText, requireAdminAction } from "./guard"

import type {
    ActionResult as Result, AnnouncementInput, AnnouncementPriority, AnnouncementStatus, AnnouncementType, PlatformAnnouncement,
} from "@/types/communications"

const TYPES = new Set<string>(["MAINTENANCE", "FEATURE_RELEASE", "POLICY_CHANGE", "PLATFORM_NEWS"])
const PRIORITIES = new Set<string>(["NORMAL", "HIGH", "URGENT"])

function toAnnouncement(row: typeof announcement.$inferSelect): PlatformAnnouncement {
    const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>
    const type = typeof meta.announcementType === "string" && TYPES.has(meta.announcementType) ? meta.announcementType as AnnouncementType : "PLATFORM_NEWS"
    const priority = PRIORITIES.has(row.priority.toUpperCase()) ? row.priority.toUpperCase() as AnnouncementPriority : "NORMAL"
    return {
        id: row.id,
        title: row.title,
        content: row.content,
        announcementType: type,
        priority,
        targetAudience: typeof meta.targetAudience === "string" ? meta.targetAudience : null,
        status: row.status,
        publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }
}

function validate(input: AnnouncementInput): string | null {
    if (!input.title.trim()) return "Give the announcement a title"
    if (input.title.trim().length > 200) return "Keep the title under 200 characters"
    if (!input.content.replace(/<[^>]*>/g, "").trim()) return "Write the announcement"
    if (!TYPES.has(input.announcementType)) return "Pick a type"
    if (!PRIORITIES.has(input.priority)) return "Pick a priority"
    return null
}

/** The list (newest first) and counts per status. Capped at 200 - the page lists with a ceiling. */
export async function getPlatformAnnouncements(): Promise<Result<{ announcements: PlatformAnnouncement[]; total: number }>> {
    try {
        await requireAdminAction("communications", "read")
        const [rows, [totalRow]] = await Promise.all([
            db.query.announcement.findMany({ orderBy: [desc(announcement.createdAt)], limit: 200 }),
            db.select({ total: count() }).from(announcement),
        ])
        return { success: true, data: { announcements: rows.map(toAnnouncement), total: totalRow?.total ?? 0 } }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not load announcements") }
    }
}

export async function createPlatformAnnouncement(input: AnnouncementInput): Promise<Result<PlatformAnnouncement>> {
    try {
        const admin = await requireAdminAction("communications", "write")
        const bad = validate(input)
        if (bad) return { success: false, error: bad }
        const [created] = await db.insert(announcement).values({
            title: input.title.trim(),
            content: input.content,
            status: input.status,
            priority: input.priority,
            authorId: admin.id,
            publishedAt: input.status === "PUBLISHED" ? new Date() : null,
            metadata: { announcementType: input.announcementType, targetAudience: input.targetAudience?.trim() || null },
        }).returning()
        if (!created) return { success: false, error: "Could not create the announcement" }

        await db.insert(adminAuditLog).values({
            adminId: admin.id,
            action: "CREATE",
            module: "communications",
            resourceType: "Announcement",
            resourceId: created.id,
            description: `Created announcement: ${created.title}`,
        })
        revalidatePath("/communications/announcements")
        return { success: true, data: toAnnouncement(created) }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not create the announcement") }
    }
}

export async function updatePlatformAnnouncement(id: string, input: AnnouncementInput): Promise<Result<PlatformAnnouncement>> {
    try {
        const admin = await requireAdminAction("communications", "write")
        const bad = validate(input)
        if (bad) return { success: false, error: bad }
        const existing = await db.query.announcement.findFirst({ where: (a, { eq }) => eq(a.id, id) })
        if (!existing) return { success: false, error: "That announcement no longer exists" }
        const [updated] = await db.update(announcement).set({
            title: input.title.trim(),
            content: input.content,
            priority: input.priority,
            status: input.status,
            publishedAt: input.status === "PUBLISHED" ? (existing.publishedAt ?? new Date()) : null,
            metadata: { announcementType: input.announcementType, targetAudience: input.targetAudience?.trim() || null },
            updatedAt: new Date(),
        }).where(eq(announcement.id, id)).returning()
        if (!updated) return { success: false, error: "Could not save the announcement" }

        await db.insert(adminAuditLog).values({
            adminId: admin.id,
            action: "UPDATE",
            module: "communications",
            resourceType: "Announcement",
            resourceId: id,
            description: `Updated announcement: ${updated.title}`,
        })
        revalidatePath("/communications/announcements")
        return { success: true, data: toAnnouncement(updated) }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not save the announcement") }
    }
}

export async function setPlatformAnnouncementStatus(id: string, status: AnnouncementStatus): Promise<Result> {
    try {
        const admin = await requireAdminAction("communications", "write")
        await db.update(announcement).set({
            status,
            publishedAt: status === "PUBLISHED" ? new Date() : undefined,
            updatedAt: new Date(),
        }).where(eq(announcement.id, id))
        await db.insert(adminAuditLog).values({
            adminId: admin.id,
            action: "UPDATE",
            module: "communications",
            resourceType: "Announcement",
            resourceId: id,
            description: `Set announcement status to ${status.toLowerCase()}`,
        })
        revalidatePath("/communications/announcements")
        return { success: true, data: null }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not change the status") }
    }
}

export async function deletePlatformAnnouncement(id: string): Promise<Result> {
    try {
        const admin = await requireAdminAction("communications", "delete")
        await db.delete(announcement).where(eq(announcement.id, id))
        await db.insert(adminAuditLog).values({
            adminId: admin.id,
            action: "DELETE",
            module: "communications",
            resourceType: "Announcement",
            resourceId: id,
            description: "Deleted an announcement",
        })
        revalidatePath("/communications/announcements")
        return { success: true, data: null }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not delete the announcement") }
    }
}
