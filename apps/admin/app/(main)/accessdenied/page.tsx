import type { Metadata } from "next"
import { AccessDeniedView } from "@/components/permission-gate"

export const metadata: Metadata = { title: "No access" }

/** Where `requireAdminPage(module)` sends an admin who lacks the module (403). */
export default function AccessDeniedPage() {
    return <AccessDeniedView />
}
