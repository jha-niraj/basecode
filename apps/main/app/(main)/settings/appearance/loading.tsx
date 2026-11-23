import { PageSkeleton } from "@repo/ui/components/ui/page"
import { AppearanceSkeleton } from "../_components/settings-skeletons"

export default function Loading() {
    return (
        <PageSkeleton width="reading" title="Appearance" description="How the app looks: theme, density and motion." icon={false}>
            <AppearanceSkeleton />
        </PageSkeleton>
    )
}
