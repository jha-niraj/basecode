import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { isGoogleConfigured } from "@repo/auth"
import { db, eq } from "@repo/db"
import { account } from "@repo/db/schema"
import { getSession } from "@/lib/session"
import { ROUTES } from "@/lib/navigation"
import { AccountsView, type AccountsData } from "./accounts-view"

export const metadata: Metadata = { title: "Connected accounts" }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AccountsPage({ searchParams }: { searchParams: SearchParams }) {
    const session = await getSession()
    if (!session) redirect(`${ROUTES.signIn}?stale=1&returnTo=${ROUTES.settingsAccounts}`)
    const [rows, sp] = await Promise.all([
        db.select({ providerId: account.providerId, password: account.password, createdAt: account.createdAt })
            .from(account).where(eq(account.userId, session.user.id)),
        searchParams,
    ])
    const google = rows.find((r) => r.providerId === "google")
    const rawError = Array.isArray(sp.error) ? sp.error[0] : sp.error
    const data: AccountsData = {
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        hasPassword: rows.some((r) => r.providerId === "credential" && Boolean(r.password)),
        google: google ? { linkedAt: google.createdAt.toISOString() } : null,
        googleAvailable: isGoogleConfigured(),
        linkError: rawError ?? null,
    }
    return <AccountsView data={data} />
}
