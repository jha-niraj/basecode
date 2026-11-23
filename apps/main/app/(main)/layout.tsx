import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { railPinnedFromCookie, railWidthCookie, railWidthFromCookie } from "@repo/ui/lib/shell"
import { getSession } from "@/lib/session"
import { getShellPrefs } from "@/lib/settings"
import { MAIN_RAIL_COOKIE, ROUTES } from "@/lib/navigation"
import { MainShell } from "./_components/main-shell"
import { AppearanceStyle } from "./_components/appearance-style"

/**
 * The signed-in area's SERVER layout. It reads only the session (React-cached, cookie-first), the rail cookie and the
 * shell prefs (onboarding done + appearance: one cached batch, `lib/settings.ts`), so the shell's first frame is right
 * and every page's loading.tsx still paints at once - it never awaits page data.
 *
 * No session here means the cookie the middleware let through is dead (expired, revoked elsewhere): `?stale=1` makes
 * the sign-in page say so in a sentence and clear the cookie. Each page and every server action still checks the
 * session itself - this check is not enough on its own.
 *
 * Not onboarded -> /welcome, which lives OUTSIDE this group (`app/(onboarding)`), so the redirect never loops (a
 * layout cannot read the pathname).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
    const [session, jar] = await Promise.all([getSession(), cookies()])
    if (!session) redirect(`${ROUTES.signIn}?stale=1`)
    const prefs = await getShellPrefs(session.user.id)
    if (!prefs.onboarded) redirect(ROUTES.onboarding)
    const initialPinned = railPinnedFromCookie(jar.get(MAIN_RAIL_COOKIE)?.value)
    const initialRailWidth = railWidthFromCookie(jar.get(railWidthCookie(MAIN_RAIL_COOKIE))?.value)
    const { user } = session

    return (
        <MainShell user={{ name: user.name, email: user.email, image: user.image }} initialPinned={initialPinned} initialRailWidth={initialRailWidth}>
            <AppearanceStyle prefs={prefs.appearance} />
            {children}
        </MainShell>
    )
}
