"use server"

/**
 * The Profile page's writes. Every export checks the session itself and returns ActionResult; better-auth calls go
 * through `auth.api` with the request's headers (nextCookies lets them set cookies from here).
 */
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@repo/auth"
import { requireSession } from "@repo/auth/next"
import { authErrorMessage } from "@repo/auth/errors"
import { db, eq } from "@repo/db"
import { user } from "@repo/db/schema"
import { fail, failWith, ok, type ActionResult } from "@repo/errors"
import { deleteFile, generateKey, getUploadUrl, isResolvedStorageValue, isStorageConfigured, storageHref } from "@repo/storage"
import { passwordChangedEmail, sendEmail } from "@repo/email"
import { eraseUser } from "@repo/erasure"
import {
    avatarUploadSchema,
    changePasswordSchema,
    profileDetailsSchema,
    setPasswordSchema,
    type ChangePasswordInput,
    type ProfileDetailsInput,
} from "@/schemas/profile"

const AVATAR_EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const

function revalidateProfile() {
    revalidatePath("/profile")
    revalidatePath("/", "layout")
}

/** A better-auth APIError (duck-typed - apps never import better-auth) as a failure with a real sentence. */
function authFailure(err: unknown): ActionResult<never> {
    if (err && typeof err === "object" && "body" in err) {
        const body = (err as { body?: unknown }).body
        const status = "statusCode" in err && typeof err.statusCode === "number" ? err.statusCode : undefined
        const code = body && typeof body === "object" && "code" in body && typeof body.code === "string" ? body.code : undefined
        const message = body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : undefined
        if (code || message) return failWith(status === 429 ? "ratelimit" : "validation", authErrorMessage(code, { status, message }))
    }
    return fail(err)
}

/** Only our own uploads (`avatars/<userId>/...`) are ever deleted - never a Google URL or someone else's key. */
function ownAvatarKey(value: string | null | undefined, userId: string): string | null {
    if (!value || isResolvedStorageValue(value)) return null
    return value.startsWith(`avatars/${userId}/`) ? value : null
}

async function deleteOwnAvatar(value: string | null | undefined, userId: string): Promise<void> {
    const key = ownAvatarKey(value, userId)
    if (!key || !isStorageConfigured()) return
    try {
        await deleteFile(key)
    } catch (err) {
        console.error("[profile] old avatar delete failed (left in place):", err)
    }
}

export async function updateProfileDetails(input: ProfileDetailsInput): Promise<ActionResult<{ name: string; bio: string }>> {
    try {
        const session = await requireSession()
        const parsed = profileDetailsSchema.safeParse(input)
        if (!parsed.success) return failWith("validation", parsed.error.issues[0]?.message ?? "Check the details.")
        const { name, bio } = parsed.data
        await db.update(user).set({ name, bio: bio || null, updatedAt: new Date() }).where(eq(user.id, session.user.id))
        revalidateProfile()
        return ok({ name, bio })
    } catch (err) {
        return fail(err)
    }
}

/** A short-lived presigned PUT for the signed-in person's avatar. The browser must send the same Content-Type. */
export async function getAvatarUploadUrl(input: { contentType: string; size: number }): Promise<ActionResult<{ uploadUrl: string; key: string }>> {
    try {
        const session = await requireSession()
        if (!isStorageConfigured()) return failWith("validation", "Photo uploads are not set up for this app yet.")
        const parsed = avatarUploadSchema.safeParse(input)
        if (!parsed.success) return failWith("validation", parsed.error.issues[0]?.message ?? "Use a JPG, PNG or WebP image.")
        const key = generateKey("avatars", session.user.id, `avatar.${AVATAR_EXT[parsed.data.contentType]}`)
        const uploadUrl = await getUploadUrl(key, parsed.data.contentType, 300)
        return ok({ uploadUrl, key })
    } catch (err) {
        return fail(err)
    }
}

/** Saves the KEY the browser just uploaded to, deletes the previous upload, returns the href to show. */
export async function saveAvatar(key: string): Promise<ActionResult<{ src: string }>> {
    try {
        const session = await requireSession({ fresh: true })
        if (!ownAvatarKey(key, session.user.id)) return failWith("validation", "That upload does not belong to your account.")
        const previous = session.user.image
        await db.update(user).set({ image: key, updatedAt: new Date() }).where(eq(user.id, session.user.id))
        if (previous && previous !== key) await deleteOwnAvatar(previous, session.user.id)
        revalidateProfile()
        return ok({ src: storageHref(key) })
    } catch (err) {
        return fail(err)
    }
}

export async function removeAvatar(): Promise<ActionResult<null>> {
    try {
        const session = await requireSession({ fresh: true })
        const previous = session.user.image
        await db.update(user).set({ image: null, updatedAt: new Date() }).where(eq(user.id, session.user.id))
        await deleteOwnAvatar(previous, session.user.id)
        revalidateProfile()
        return ok(null)
    } catch (err) {
        return fail(err)
    }
}

export async function changePassword(input: ChangePasswordInput): Promise<ActionResult<null>> {
    try {
        const session = await requireSession()
        const parsed = changePasswordSchema.safeParse(input)
        if (!parsed.success) return failWith("validation", parsed.error.issues[0]?.message ?? "Check the passwords.")
        try {
            await auth.api.changePassword({ body: parsed.data, headers: await headers() })
        } catch (err) {
            return authFailure(err)
        }
        const mail = await sendEmail({ kind: "transactional", to: session.user.email, ...passwordChangedEmail({ name: session.user.name }) })
        if (mail.status === "failed") console.error("[profile] password-changed email failed:", mail.error)
        if (parsed.data.revokeOtherSessions) revalidatePath("/profile")
        return ok(null)
    } catch (err) {
        return fail(err)
    }
}

/** For an account with no password yet (Google or email code only): adds an email + password login. */
export async function setPassword(input: { newPassword: string }): Promise<ActionResult<null>> {
    try {
        const session = await requireSession()
        const parsed = setPasswordSchema.safeParse(input)
        if (!parsed.success) return failWith("validation", parsed.error.issues[0]?.message ?? "Check the password.")
        try {
            await auth.api.setPassword({ body: { newPassword: parsed.data.newPassword }, headers: await headers() })
        } catch (err) {
            return authFailure(err)
        }
        const mail = await sendEmail({ kind: "transactional", to: session.user.email, ...passwordChangedEmail({ name: session.user.name }) })
        if (mail.status === "failed") console.error("[profile] password-set email failed:", mail.error)
        revalidateProfile()
        return ok(null)
    } catch (err) {
        return fail(err)
    }
}

/** Signs one other device out. The client sends the session ID; the token is looked up here and never leaves. */
export async function revokeSession(sessionId: string): Promise<ActionResult<null>> {
    try {
        const session = await requireSession()
        if (sessionId === session.session.id) return failWith("validation", "Use Sign out to end this device's session.")
        const h = await headers()
        const list = await auth.api.listSessions({ headers: h })
        const target = list.find((s) => s.id === sessionId)
        if (!target) return failWith("notfound", "That device is already signed out.")
        try {
            await auth.api.revokeSession({ body: { token: target.token }, headers: h })
        } catch (err) {
            return authFailure(err)
        }
        revalidatePath("/profile")
        return ok(null)
    } catch (err) {
        return fail(err)
    }
}

export async function revokeOtherSessions(): Promise<ActionResult<null>> {
    try {
        await requireSession()
        try {
            await auth.api.revokeOtherSessions({ headers: await headers() })
        } catch (err) {
            return authFailure(err)
        }
        revalidatePath("/profile")
        return ok(null)
    } catch (err) {
        return fail(err)
    }
}

/**
 * Deletes the account and everything that belongs to it (@repo/erasure). The person types their email to confirm;
 * it is checked here too. The client signs out (clears the cookies) after this resolves.
 */
export async function deleteAccount(confirmEmail: string): Promise<ActionResult<{ deleted: true }>> {
    try {
        const session = await requireSession({ fresh: true })
        if (confirmEmail.trim().toLowerCase() !== session.user.email.toLowerCase()) {
            return failWith("validation", "Type your email exactly as shown to confirm.")
        }
        return await eraseUser(session.user.id)
    } catch (err) {
        return fail(err)
    }
}
