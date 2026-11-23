import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { and, db, eq } from "@repo/db"
import { user, userSetting } from "@repo/db/schema"
import { needsAcceptance } from "@repo/legal"
import { isResolvedStorageValue, isStorageConfigured, storageHref } from "@repo/storage"
import { getSession } from "@/lib/session"
import { ROUTES } from "@/lib/navigation"
import { SETTING_KEYS, isUseFor, type UseFor } from "@/lib/settings-values"
import { WelcomeFlow, type WelcomeData } from "./welcome-flow"

export const metadata: Metadata = { title: "Welcome" }

/** Read fresh (the cookie session can be minutes behind). Already onboarded -> straight to the AI page. */
export default async function WelcomePage() {
    const session = await getSession()
    if (!session) redirect(`${ROUTES.signIn}?stale=1`)
    const [rows, useForRows, missing] = await Promise.all([
        db.select({ name: user.name, email: user.email, image: user.image, onboardedAt: user.onboardedAt })
            .from(user).where(eq(user.id, session.user.id)).limit(1),
        db.select({ value: userSetting.value }).from(userSetting)
            .where(and(eq(userSetting.userId, session.user.id), eq(userSetting.key, SETTING_KEYS.useFor))).limit(1),
        needsAcceptance(session.user.id),
    ])
    const me = rows[0]
    if (!me) redirect(`${ROUTES.signIn}?stale=1`)
    if (me.onboardedAt) redirect(ROUTES.ai)

    const stored = useForRows[0]?.value
    const useFor: UseFor[] = Array.isArray(stored) ? stored.filter((v): v is UseFor => typeof v === "string" && isUseFor(v)) : []

    const data: WelcomeData = {
        name: me.name,
        email: me.email,
        avatarSrc: storageHref(me.image),
        hasUploadedAvatar: Boolean(me.image && !isResolvedStorageValue(me.image)),
        storageReady: isStorageConfigured(),
        useFor,
        legalAccepted: missing.length === 0,
    }
    return <WelcomeFlow data={data} />
}
