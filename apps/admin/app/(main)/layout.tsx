import { cookies } from "next/headers"
import { railPinnedFromCookie, railWidthCookie, railWidthFromCookie } from "@repo/ui/lib/shell"
import { requireActiveAdmin } from "@/lib/admin-session"
import { ADMIN_RAIL_COOKIE } from "@/lib/navigation"
import { AdminShell } from "./_components/admin-shell"

/**
 * The console's SERVER layout: the admin (session + access row, React-cached) and the rail cookie are read here, so
 * the shell's first frame is right (no flash, no client session fetch). It awaits only those two reads - never page
 * data, which would block every page's loading.tsx. Each page still checks its own module (`requireAdminPage`).
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
    const [admin, jar] = await Promise.all([requireActiveAdmin(), cookies()])
    const initialPinned = railPinnedFromCookie(jar.get(ADMIN_RAIL_COOKIE)?.value)
    const initialRailWidth = railWidthFromCookie(jar.get(railWidthCookie(ADMIN_RAIL_COOKIE))?.value)

    return (
        <AdminShell
            admin={{ role: admin.role, permissions: admin.permissions, name: admin.name, email: admin.email, image: admin.image }}
            initialPinned={initialPinned}
            initialRailWidth={initialRailWidth}
        >
            {children}
        </AdminShell>
    )
}
