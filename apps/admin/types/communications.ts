/**
 * Announcement and broadcast types and value lists. Not in the 'use server' action files: a server-action module may
 * export only async functions (a constant there empties the module at build).
 */
export type AnnouncementType = "MAINTENANCE" | "FEATURE_RELEASE" | "POLICY_CHANGE" | "PLATFORM_NEWS"
export type AnnouncementPriority = "NORMAL" | "HIGH" | "URGENT"
export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED"

export const ANNOUNCEMENT_TYPES: { value: AnnouncementType; label: string }[] = [
    { value: "PLATFORM_NEWS", label: "Platform news" },
    { value: "FEATURE_RELEASE", label: "Feature release" },
    { value: "MAINTENANCE", label: "Maintenance" },
    { value: "POLICY_CHANGE", label: "Policy change" },
]
export const ANNOUNCEMENT_PRIORITIES: { value: AnnouncementPriority; label: string }[] = [
    { value: "NORMAL", label: "Normal" },
    { value: "HIGH", label: "High" },
    { value: "URGENT", label: "Urgent" },
]

export interface PlatformAnnouncement {
    id: string
    title: string
    /** Rich-text HTML from the editor. */
    content: string
    announcementType: AnnouncementType
    priority: AnnouncementPriority
    /** A free note on who it is for; replace with real targeting per product. */
    targetAudience: string | null
    status: AnnouncementStatus
    publishedAt: string | null
    createdAt: string
    updatedAt: string
}

export interface AnnouncementInput {
    title: string
    content: string
    announcementType: AnnouncementType
    priority: AnnouncementPriority
    targetAudience?: string | null
    status: "DRAFT" | "PUBLISHED"
}

export type BroadcastTone = "info" | "warning" | "error" | "success"
export type BroadcastStatus = "DRAFT" | "SENT" | "SCHEDULED" | "FAILED"

export const BROADCAST_TONES: { value: BroadcastTone; label: string }[] = [
    { value: "info", label: "Information" },
    { value: "success", label: "Good news" },
    { value: "warning", label: "Heads up" },
    { value: "error", label: "Problem" },
]

export interface PlatformBroadcast {
    id: string
    subject: string
    /** Plain text body. */
    content: string
    type: BroadcastTone
    actionUrl: string | null
    actionLabel: string | null
    status: BroadcastStatus
    recipientCount: number
    sentCount: number
    sentAt: string | null
    createdAt: string
    updatedAt: string
}

export interface BroadcastInput {
    subject: string
    content: string
    type: BroadcastTone
    actionUrl?: string
    actionLabel?: string
}

export type ActionResult<T = null> = { success: true; data: T } | { success: false; error: string }
