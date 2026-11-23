import type { Metadata } from 'next'
import { SITE } from '@repo/core/site'
import { AiRoute } from './_components/ai-route'

export const metadata: Metadata = { title: 'AI' }

/** /ai - a new chat. The landing after sign-in. */
export default function AiNewChatPage() {
    return <AiRoute conversationId={null} />
}
