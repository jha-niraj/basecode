"use server"

import { requireSession } from "@repo/auth/next"
import { fail, ok, type ActionResult } from "@repo/errors"
import { getDashboard as readDashboard, type DashboardData } from "@/lib/dashboard"

/** /home's refetch - the same shape the page passes as initialData. */
export async function getDashboard(): Promise<ActionResult<DashboardData>> {
    try {
        const session = await requireSession()
        return ok(await readDashboard(session.user.id))
    } catch (err) {
        return fail(err, "home.dashboard")
    }
}
