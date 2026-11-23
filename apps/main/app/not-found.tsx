import { ArrowLeft } from "lucide-react"
import { AppLink } from "@repo/ui/components/app-link"
import { Button } from "@repo/ui/components/ui/button"
import { StatusView } from "@repo/ui/components/ui/status-view"

/** A 404 outside the app shell: the dashed page and the magnifier, with a way home. */
export default function NotFound() {
    return (
        <StatusView
            kind="not-found"
            actions={(
                <Button asChild className="h-10 cursor-pointer gap-2 rounded-xl">
                    <AppLink href="/"><ArrowLeft className="h-4 w-4" /> Go to the start page</AppLink>
                </Button>
            )}
        />
    )
}
