import { UserRound } from "lucide-react"
import { SectionCardSkeleton } from "@repo/ui/components/skeleton-kit"
import { PageSkeleton } from "@repo/ui/components/ui/page"

export function ProfileSkeleton() {
    return (
        <PageSkeleton title="Profile" description="Your admin account, your access and your password." icon={<UserRound />} tabs={3}>
            <SectionCardSkeleton />
        </PageSkeleton>
    )
}
