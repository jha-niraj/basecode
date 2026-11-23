import type { Metadata } from "next"
import { ArrowLeft } from "lucide-react"
import { AppLink } from "@repo/ui/components/app-link"
import { Button } from "@repo/ui/components/ui/button"
import { StatusView } from "@repo/ui/components/ui/status-view"
import { ROUTES } from "@/lib/navigation"

export const metadata: Metadata = { title: "No access" }

/** The 403 screen: where a page guard sends someone without the permission it needs. */
export default function AccessDeniedPage() {
    return (
        <StatusView
            kind="forbidden"
            fullScreen={false}
            actions={(
                <Button asChild variant="outline" className="h-10 cursor-pointer gap-2 rounded-xl">
                    <AppLink href={ROUTES.home}><ArrowLeft className="h-4 w-4" /> Back to the start</AppLink>
                </Button>
            )}
        />
    )
}
