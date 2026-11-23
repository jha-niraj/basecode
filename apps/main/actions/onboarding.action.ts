"use server"

/**
 * /welcome's writes. Every export checks the session itself and returns ActionResult. The photo reuses the profile's
 * `getAvatarUploadUrl` / `saveAvatar`.
 */
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { requireSession } from "@repo/auth/next"
import { db, eq } from "@repo/db"
import { user, userSetting } from "@repo/db/schema"
import { fail, failWith, ok, type ActionResult } from "@repo/errors"
import { needsAcceptance, recordCurrentAcceptances } from "@repo/legal"
import { SETTING_KEYS, isUseFor } from "@/lib/settings-values"

export async function saveWelcomeName(input: { name: string }): Promise<ActionResult<{ name: string }>> {
    try {
        const session = await requireSession()
        const name = typeof input.name === "string" ? input.name.trim() : ""
        if (!name) return failWith("validation", "Enter your name.")
        if (name.length > 80) return failWith("validation", "Keep the name under 80 characters.")
        await db.update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, session.user.id))
        return ok({ name })
    } catch (err) {
        return fail(err, "welcome.name")
    }
}

export async function saveUseFor(input: { values: string[] }): Promise<ActionResult<null>> {
    try {
        const session = await requireSession()
        const values = Array.isArray(input.values) ? [...new Set(input.values.filter((v) => typeof v === "string" && isUseFor(v)))] : []
        await db.insert(userSetting)
            .values({ userId: session.user.id, key: SETTING_KEYS.useFor, value: values, updatedAt: new Date() })
            .onConflictDoUpdate({ target: [userSetting.userId, userSetting.key], set: { value: values, updatedAt: new Date() } })
        return ok(null)
    } catch (err) {
        return fail(err, "welcome.useFor")
    }
}

/** Records acceptance of the CURRENT terms and privacy versions (idempotent). */
export async function acceptLegal(): Promise<ActionResult<null>> {
    try {
        const session = await requireSession()
        const h = await headers()
        const missing = await needsAcceptance(session.user.id)
        await recordCurrentAcceptances(session.user.id, missing, {
            ipAddress: h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
            userAgent: h.get("user-agent"),
        })
        return ok(null)
    } catch (err) {
        return fail(err, "welcome.legal")
    }
}

/** The last step. Refused until the current terms and privacy are accepted. */
export async function finishOnboarding(): Promise<ActionResult<null>> {
    try {
        const session = await requireSession()
        const missing = await needsAcceptance(session.user.id)
        if (missing.length > 0) return failWith("validation", "Accept the terms and the privacy policy to continue.")
        await db.update(user).set({ onboardedAt: new Date(), updatedAt: new Date() }).where(eq(user.id, session.user.id))
        revalidatePath("/", "layout")
        return ok(null)
    } catch (err) {
        return fail(err, "welcome.finish")
    }
}
