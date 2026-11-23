"use server"

import { db } from "@repo/db"
import { announcement, broadcast } from "@repo/db/schema"
import { count, desc, gte, sql } from "@repo/db"
import { errorText, requireAdminAction } from "./guard"
import type { ActionResult as Result } from "@/types/communications"

/**
 * The communications overview's numbers. The list actions live in announcements.action.ts and broadcasts.action.ts
 * (the older duplicate list / create actions that lived here were unused and are gone - each export is a public
 * endpoint).
 */
export interface CommunicationsOverview {
    announcements: { published: number; drafts: number; archived: number; createdLast30: number }
    broadcasts: { drafts: number; sent: number; emailsSentLast30: number; createdLast30: number }
    latest: { kind: "announcement" | "broadcast"; id: string; title: string; status: string; createdAt: string }[]
    generatedAt: string
}

export async function getCommunicationsOverview(): Promise<Result<CommunicationsOverview>> {
    try {
        await requireAdminAction("communications", "read")
        const now = new Date()
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const [annByStatus, [ann30], brByStatus, [br30], [sent30], latestAnn, latestBr] = await Promise.all([
            db.select({ status: announcement.status, c: count() }).from(announcement).groupBy(announcement.status),
            db.select({ c: count() }).from(announcement).where(gte(announcement.createdAt, d30)),
            db.select({ status: broadcast.status, c: count() }).from(broadcast).groupBy(broadcast.status),
            db.select({ c: count() }).from(broadcast).where(gte(broadcast.createdAt, d30)),
            db.select({ n: sql<number>`coalesce(sum(${broadcast.sentCount}), 0)::int` }).from(broadcast)
                .where(gte(broadcast.sentAt, d30)),
            db.query.announcement.findMany({ orderBy: [desc(announcement.createdAt)], limit: 5, columns: { id: true, title: true, status: true, createdAt: true } }),
            db.query.broadcast.findMany({ orderBy: [desc(broadcast.createdAt)], limit: 5, columns: { id: true, subject: true, status: true, createdAt: true } }),
        ])
        const a = (s: string) => annByStatus.find((r) => r.status === s)?.c ?? 0
        const b = (s: string) => brByStatus.find((r) => r.status === s)?.c ?? 0

        const latest = [
            ...latestAnn.map((r) => ({ kind: "announcement" as const, id: r.id, title: r.title, status: r.status, createdAt: r.createdAt.toISOString() })),
            ...latestBr.map((r) => ({ kind: "broadcast" as const, id: r.id, title: r.subject, status: r.status, createdAt: r.createdAt.toISOString() })),
        ].sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, 6)

        return {
            success: true,
            data: {
                announcements: { published: a("PUBLISHED"), drafts: a("DRAFT"), archived: a("ARCHIVED"), createdLast30: ann30?.c ?? 0 },
                broadcasts: { drafts: b("DRAFT"), sent: b("SENT"), emailsSentLast30: Number(sent30?.n ?? 0), createdLast30: br30?.c ?? 0 },
                latest,
                generatedAt: now.toISOString(),
            },
        }
    } catch (err) {
        return { success: false, error: errorText(err, "Could not load the communications overview") }
    }
}
