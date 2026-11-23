"use server"

import { revalidatePath } from "next/cache"
import { db } from "@repo/db"
import { adminAuditLog, broadcast } from "@repo/db/schema"
import { count, desc, eq } from "@repo/db"
import { button, esc, heading, layout, paragraph, sendEmail } from "@repo/email"
import { errorText, requireAdminAction } from "./guard"
import type { ActionResult as Result, BroadcastInput, BroadcastStatus, BroadcastTone, PlatformBroadcast } from "@/types/communications"

const TONES = new Set<string>(["info", "warning", "error", "success"])

function toBroadcast(row: typeof broadcast.$inferSelect): PlatformBroadcast {
    const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>
    return {
        id: row.id,
        subject: row.subject,
        content: row.content,
        type: typeof meta.type === "string" && TONES.has(meta.type) ? meta.type as BroadcastTone : "info",
        actionUrl: typeof meta.actionUrl === "string" && meta.actionUrl ? meta.actionUrl : null,
        actionLabel: typeof meta.actionLabel === "string" && meta.actionLabel ? meta.actionLabel : null,
        status: row.status as BroadcastStatus,
        recipientCount: row.recipientCount,
        sentCount: row.sentCount,
        sentAt: row.sentAt ? row.sentAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    }
}

function validate(input: BroadcastInput): string | null {
    if (!input.subject.trim()) return "Give the broadcast a subject"
    if (input.subject.trim().length > 200) return "Keep the subject under 200 characters"
    if (!input.content.trim()) return "Write the message"
    if (!TONES.has(input.type)) return "Pick a tone"
    if (input.actionUrl && !/^https?:\/\//i.test(input.actionUrl.trim())) return "The button link must start with https://"
    return null
}

function metadataOf(input: BroadcastInput) {
    return {
        type: input.type,
        actionUrl: input.actionUrl?.trim() || null,
        actionLabel: input.actionLabel?.trim() || null,
    }
}

export async function getBroadcasts(): Promise<Result<{ broadcasts: PlatformBroadcast[]; total: number }>> {
    try {
        await requireAdminAction("communications", "read")
        const [rows, [totalRow]] = await Promise.all([
            db.query.broadcast.findMany({ orderBy: [desc(broadcast.createdAt)], limit: 200 }),
            db.select({ total: count() }).from(broadcast),
        ])
        return { success: true, data: { broadcasts: rows.map(toBroadcast), total: totalRow?.total ?? 0 } }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not load broadcasts") }
    }
}

export async function createBroadcast(input: BroadcastInput): Promise<Result<PlatformBroadcast>> {
    try {
        const admin = await requireAdminAction("communications", "write")
        const bad = validate(input)
        if (bad) return { success: false, error: bad }
        const [created] = await db.insert(broadcast).values({
            subject: input.subject.trim(),
            content: input.content,
            status: "DRAFT",
            recipientType: "all",
            recipientCount: 0,
            sentCount: 0,
            authorId: admin.id,
            metadata: metadataOf(input),
        }).returning()
        if (!created) return { success: false, error: "Could not create the broadcast" }
        await db.insert(adminAuditLog).values({
            adminId: admin.id,
            action: "CREATE",
            module: "communications",
            resourceType: "Broadcast",
            resourceId: created.id,
            description: `Created broadcast: ${created.subject}`,
        })
        revalidatePath("/communications/broadcasts")
        return { success: true, data: toBroadcast(created) }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not create the broadcast") }
    }
}

export async function updateBroadcast(id: string, input: BroadcastInput): Promise<Result<PlatformBroadcast>> {
    try {
        const admin = await requireAdminAction("communications", "write")
        const bad = validate(input)
        if (bad) return { success: false, error: bad }
        const existing = await db.query.broadcast.findFirst({ where: (b, { eq }) => eq(b.id, id) })
        if (!existing) return { success: false, error: "That broadcast no longer exists" }
        if (existing.status === "SENT") return { success: false, error: "A sent broadcast can't be edited" }
        const [updated] = await db.update(broadcast).set({
            subject: input.subject.trim(),
            content: input.content,
            metadata: metadataOf(input),
            updatedAt: new Date(),
        }).where(eq(broadcast.id, id)).returning()
        if (!updated) return { success: false, error: "Could not save the broadcast" }
        await db.insert(adminAuditLog).values({
            adminId: admin.id,
            action: "UPDATE",
            module: "communications",
            resourceType: "Broadcast",
            resourceId: id,
            description: `Updated broadcast: ${updated.subject}`,
        })
        revalidatePath("/communications/broadcasts")
        return { success: true, data: toBroadcast(updated) }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not save the broadcast") }
    }
}

export async function deleteBroadcast(id: string): Promise<Result> {
    try {
        const admin = await requireAdminAction("communications", "delete")
        await db.delete(broadcast).where(eq(broadcast.id, id))
        await db.insert(adminAuditLog).values({
            adminId: admin.id,
            action: "DELETE",
            module: "communications",
            resourceType: "Broadcast",
            resourceId: id,
            description: "Deleted a broadcast",
        })
        revalidatePath("/communications/broadcasts")
        return { success: true, data: null }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not delete the broadcast") }
    }
}

/**
 * Sends the draft to the signed-in admin only, as a preview. Sending to every user is NOT here on purpose: it is a
 * long job (a Workflow that batches, retries and records progress - AGENTS.md section 5) and marketing mail needs an
 * unsubscribe link per person. Build it per product.
 */
export async function sendTestBroadcastEmail(input: BroadcastInput): Promise<Result<{ sentTo: string; skipped: boolean }>> {
    try {
        const admin = await requireAdminAction("communications", "write")
        const bad = validate(input)
        if (bad) return { success: false, error: bad }
        if (!admin.email) return { success: false, error: "Your account has no email address" }

        const body = [
            paragraph("<strong>Test - only you received this.</strong>"),
            heading(input.subject.trim()),
            ...input.content.split(/\n{2,}/).map((p) => paragraph(esc(p).replace(/\n/g, "<br />"))),
            input.actionUrl?.trim() ? button(input.actionLabel?.trim() || "Open", input.actionUrl.trim()) : "",
        ].join("")
        const html = layout({ preheader: input.subject.trim(), body, footnote: "A test of a broadcast draft from the admin console." })
        const res = await sendEmail({ kind: "transactional", to: admin.email, subject: `[Test] ${input.subject.trim()}`, html })
        if (res.status === "failed") return { success: false, error: "The email could not be sent. Check the email settings." }
        return { success: true, data: { sentTo: admin.email, skipped: res.status === "skipped" } }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not send the test email") }
    }
}
