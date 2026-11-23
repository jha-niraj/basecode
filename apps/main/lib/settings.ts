import "server-only"

import { cache } from "react"
import { and, db, eq, inArray } from "@repo/db"
import { notificationPreference, user, userSetting } from "@repo/db/schema"
import {
    DEFAULT_APPEARANCE,
    NOTIFICATION_TOPICS,
    SETTING_KEYS,
    type AppearancePrefs,
    type NotificationPreferenceView,
    type NotificationTopic,
} from "./settings-values"

/**
 * Server-side reads of the Settings hub's tables. Never a 'use server' file: these take a user id, so as endpoints they
 * would read anyone's settings.
 */

const APPEARANCE_KEYS = [SETTING_KEYS.density, SETTING_KEYS.reducedMotion]

export function appearanceFromRows(rows: { key: string; value: unknown }[]): AppearancePrefs {
    const out: AppearancePrefs = { ...DEFAULT_APPEARANCE }
    for (const r of rows) {
        if (r.key === SETTING_KEYS.density && (r.value === "compact" || r.value === "comfortable")) out.density = r.value
        if (r.key === SETTING_KEYS.reducedMotion && typeof r.value === "boolean") out.reducedMotion = r.value
    }
    return out
}

export interface ShellPrefs {
    /** The person exists and has finished /welcome. */
    onboarded: boolean
    appearance: AppearancePrefs
}

/**
 * What the signed-in layout needs besides the session: onboarding done, and the appearance prefs it applies on the
 * first frame. ONE round trip (a batch), once per request (React cache).
 */
export const getShellPrefs = cache(async (userId: string): Promise<ShellPrefs> => {
    const [me, rows] = await db.batch([
        db.select({ onboardedAt: user.onboardedAt }).from(user).where(eq(user.id, userId)).limit(1),
        db.select({ key: userSetting.key, value: userSetting.value }).from(userSetting)
            .where(and(eq(userSetting.userId, userId), inArray(userSetting.key, APPEARANCE_KEYS))),
    ])
    return { onboarded: Boolean(me[0]?.onboardedAt), appearance: appearanceFromRows(rows) }
})

/** Every topic with the person's choice, or the default (both on) when they never changed it. */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferenceView[]> {
    const rows = await db.select({ topic: notificationPreference.topic, email: notificationPreference.email, inApp: notificationPreference.inApp })
        .from(notificationPreference).where(eq(notificationPreference.userId, userId))
    const byTopic = new Map(rows.map((r) => [r.topic, r]))
    return NOTIFICATION_TOPICS.map((t) => {
        const r = byTopic.get(t.key)
        const locked = "emailLocked" in t && t.emailLocked
        return { topic: t.key, email: locked ? true : (r?.email ?? true), inApp: r?.inApp ?? true }
    })
}

/** Whether to send `topic` on `channel` - for code that creates notifications or emails. Defaults to yes. */
export async function wantsNotification(userId: string, topic: NotificationTopic, channel: "email" | "inApp"): Promise<boolean> {
    const t = NOTIFICATION_TOPICS.find((x) => x.key === topic)
    if (channel === "email" && t && "emailLocked" in t && t.emailLocked) return true
    const [row] = await db.select({ email: notificationPreference.email, inApp: notificationPreference.inApp })
        .from(notificationPreference)
        .where(and(eq(notificationPreference.userId, userId), eq(notificationPreference.topic, topic)))
        .limit(1)
    if (!row) return true
    return channel === "email" ? row.email : row.inApp
}
