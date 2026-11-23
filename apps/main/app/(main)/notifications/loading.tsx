import { PageSkeleton } from "@repo/ui/components/ui/page"
import { NotificationsListSkeleton } from "./notifications-skeleton"

export default function Loading() {
    return (
        <PageSkeleton title="Notifications" description="Everything the app has told you, newest first." icon={false} tabs={2} actions={1} primaryAction body="fill">
            <NotificationsListSkeleton />
        </PageSkeleton>
    )
}
