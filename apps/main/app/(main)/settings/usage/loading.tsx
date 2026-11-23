import { PageSkeleton } from "@repo/ui/components/ui/page"
import { UsageSkeleton } from "../_components/settings-skeletons"

export default function Loading() {
    return (
        <PageSkeleton title="AI usage" description="What your AI requests cost - days are UTC days." icon={false}>
            <UsageSkeleton />
        </PageSkeleton>
    )
}
