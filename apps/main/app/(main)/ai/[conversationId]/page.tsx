import type { Metadata } from 'next'
import { SITE } from '@repo/core/site'
import { AiRoute } from '../_components/ai-route'

export const metadata: Metadata = { title: 'AI' }

/** /ai/<id> - one saved chat, re-rendered with its cards and links. */
export default async function AiConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
    const { conversationId } = await params
    return <AiRoute conversationId={conversationId} />
}
