import { SITE } from '@repo/core/site'
import { AiPageSkeleton } from '@/components/ai/ai-skeleton'

/** A saved chat loading - same skeleton as /ai (the chat title is data, so the product title stands in). */
export default function AiConversationLoading() {
    return <AiPageSkeleton title={`${SITE.name} AI`} />
}
