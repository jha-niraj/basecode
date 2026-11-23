import { PageSkeleton } from "@repo/ui/components/ui/page"
import { NotificationsSettingsSkeleton } from "../_components/settings-skeletons"

export default function Loading() {
    return (
        <PageSkeleton width="reading" title="Notifications" description="Choose what reaches your inbox and what shows in the app." icon={false} actions={1}>
            <NotificationsSettingsSkeleton />
        </PageSkeleton>
    )
}
