import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { ROUTES } from "@/lib/navigation"

/**
 * The first-run flow sits outside (main): no rail, no tab bar, one card centred on the page. Outside the group also
 * means the (main) layout's "not onboarded -> /welcome" redirect can never loop. The middleware already requires the
 * session cookie here; this checks the session itself.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession()
    if (!session) redirect(`${ROUTES.signIn}?stale=1`)
    return (
        <div className="flex min-h-dvh w-full items-start justify-center bg-neutral-50 px-4 py-10 sm:items-center dark:bg-[#121314]">
            <div className="w-full max-w-lg">{children}</div>
        </div>
    )
}
