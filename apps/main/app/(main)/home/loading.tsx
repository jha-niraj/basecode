import { PageSkeleton } from "@repo/ui/components/ui/page"
import { HomeSkeleton } from "./home-skeleton"

export default function Loading() {
    return (
        <PageSkeleton title="Home" description="How your work is going, and where you left off." icon={false} body="page">
            <HomeSkeleton />
        </PageSkeleton>
    )
}
