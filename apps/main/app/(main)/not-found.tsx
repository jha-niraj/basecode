import { ArrowLeft } from "lucide-react"
import { AppLink } from "@repo/ui/components/app-link"
import { Button } from "@repo/ui/components/ui/button"
import { StatusView } from "@repo/ui/components/ui/status-view"
import { ROUTES } from "@/lib/navigation"

export default function AppNotFound() {
    return (
        <StatusView
            kind="not-found"
            fullScreen={false}
            actions={(
                <Button asChild className="h-10 cursor-pointer gap-2 rounded-xl">
                    <AppLink href={ROUTES.home}><ArrowLeft className="h-4 w-4" /> Back to the start</AppLink>
                </Button>
            )}
        />
    )
}
