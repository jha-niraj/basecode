import { SITE } from '@repo/core/site'
import { AiPageSkeleton } from '@/components/ai/ai-skeleton'

/** Painted the moment navigation to /ai starts: the real title, the transcript at the transcript's width. */
export default function AiLoading() {
    return <AiPageSkeleton title={`${SITE.name} AI`} />
}
