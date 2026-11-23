import "server-only"

import { db } from "@repo/db"
import { notification } from "@repo/db/schema"
import { wantsNotification } from "./settings"
import type { NotificationTopic } from "./settings-values"

type NotificationType = (typeof notification.$inferInsert)["type"]

export interface CreateNotificationInput {
    userId: string
    title: string
    message: string
    type?: NotificationType
    actionUrl?: string
    actionLabel?: string
    metadata?: Record<string, unknown>
    /** What it is about. With a topic, a person who turned that topic's in-app notifications off gets none. */
    topic?: NotificationTopic
}

/**
 * Create a notification for a person - for other SERVER code (a webhook, a job, an action after its own checks).
 * Never a 'use server' export: that would let anyone notify anyone. Returns false when the person's preferences
 * skipped it.
 */
export async function createNotification(input: CreateNotificationInput): Promise<boolean> {
    if (input.topic && !(await wantsNotification(input.userId, input.topic, "inApp"))) return false
    await db.insert(notification).values({
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type ?? "info",
        actionUrl: input.actionUrl,
        actionLabel: input.actionLabel,
        metadata: input.topic ? { ...input.metadata, topic: input.topic } : input.metadata,
    })
    return true
}
