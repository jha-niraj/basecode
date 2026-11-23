import "server-only"

import { and, count, db, desc, eq, gte, isNull, sql } from "@repo/db"
import { aiConversations, aiUsageLogs, notes, notification } from "@repo/db/schema"
import { lastUtcDays } from "./format"

/**
 * /home's numbers, all for the signed-in person, in ONE round trip (a batch). Windows are named (AGENTS.md section 9):
 * chats all time + last 7 days, AI cost this month (UTC), chats per UTC day for the last 14 days.
 */
export interface ActivityItem {
    kind: "chat" | "note"
    id: string
    title: string
    at: string
}

export interface DashboardData {
    notes: number
    chats: number
    chatsLast7: number
    costThisMonthMicroUsd: number
    unread: number
    /** Oldest first; a day with no new chats is 0 (a count of events: none is the answer). */
    chatsPerDay: { day: string; count: number }[]
    recent: ActivityItem[]
}

const RECENT_EACH = 6
const RECENT_TOTAL = 8

export async function getDashboard(userId: string, now: Date = new Date()): Promise<DashboardData> {
    const days = lastUtcDays(14, now)
    const since14 = new Date(`${days[0]}T00:00:00Z`)
    const since7 = new Date(`${days[days.length - 7]}T00:00:00Z`)
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const dayExpr = sql<string>`to_char(date_trunc('day', ${aiConversations.createdAt}), 'YYYY-MM-DD')`

    const [noteCount, chatCounts, cost, unread, perDay, recentChats, recentNotes] = await db.batch([
        db.select({ value: count() }).from(notes).where(and(eq(notes.userId, userId), isNull(notes.archivedAt))),
        db.select({
            all: count(),
            last7: sql<number>`count(*) filter (where ${aiConversations.createdAt} >= ${since7.toISOString()}::timestamp)`.mapWith(Number),
        }).from(aiConversations).where(eq(aiConversations.userId, userId)),
        db.select({ value: sql<number>`coalesce(sum(${aiUsageLogs.costMicroUsd}), 0)`.mapWith(Number) })
            .from(aiUsageLogs).where(and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, monthStart))),
        db.select({ value: count() }).from(notification).where(and(eq(notification.userId, userId), eq(notification.isRead, false))),
        db.select({ day: dayExpr, value: count() }).from(aiConversations)
            .where(and(eq(aiConversations.userId, userId), gte(aiConversations.createdAt, since14)))
            .groupBy(dayExpr),
        db.select({ id: aiConversations.id, title: aiConversations.title, at: aiConversations.updatedAt }).from(aiConversations)
            .where(eq(aiConversations.userId, userId)).orderBy(desc(aiConversations.updatedAt)).limit(RECENT_EACH),
        db.select({ id: notes.id, title: notes.title, at: notes.updatedAt }).from(notes)
            .where(and(eq(notes.userId, userId), isNull(notes.archivedAt))).orderBy(desc(notes.updatedAt)).limit(RECENT_EACH),
    ])

    const byDay = new Map(perDay.map((d) => [d.day, d.value]))
    const recent: ActivityItem[] = [
        ...recentChats.map((c) => ({ kind: "chat" as const, id: c.id, title: c.title, at: c.at.toISOString() })),
        ...recentNotes.map((n) => ({ kind: "note" as const, id: n.id, title: n.title, at: n.at.toISOString() })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, RECENT_TOTAL)

    return {
        notes: noteCount[0]?.value ?? 0,
        chats: chatCounts[0]?.all ?? 0,
        chatsLast7: chatCounts[0]?.last7 ?? 0,
        costThisMonthMicroUsd: cost[0]?.value ?? 0,
        unread: unread[0]?.value ?? 0,
        chatsPerDay: days.map((day) => ({ day, count: byDay.get(day) ?? 0 })),
        recent,
    }
}
