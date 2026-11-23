import { PageSkeleton } from "@repo/ui/components/ui/page"
import { AccountsSkeleton } from "../_components/settings-skeletons"

export default function Loading() {
    return (
        <PageSkeleton width="reading" title="Connected accounts" description="The ways you can sign in to this account." icon={false}>
            <AccountsSkeleton />
        </PageSkeleton>
    )
}
