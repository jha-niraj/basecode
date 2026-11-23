import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { listConversationsFor, loadConversationView, needsYouFor } from '@/lib/ai/conversations'
import { webSearchEnabled } from '@/lib/ai/tools'
import { AiPage } from '@/components/ai/ai-page'
import type { ConversationRow, NeedsYouList } from '@/lib/ai/types'

/**
 * The AI page's server half, shared by /ai and /ai/[conversationId]. It awaits only the session and (for a chat URL)
 * that conversation; History and Needs you start here as promises and stream into the column (read with `use()`).
 * A conversation id that is not this person's (deleted, or another account on this browser) falls back to a new chat.
 */
export async function AiRoute({ conversationId }: { conversationId: string | null }) {
    const s = await getSession()
    if (!s) redirect('/signin')
    const me = s.user

    // A failed read shows inline in the column (the client query retries), never an error page.
    const historyPromise = listConversationsFor(me.id).catch((): ConversationRow[] => [])
    const needsYouPromise = needsYouFor({ id: me.id, role: me.role, emailVerified: me.emailVerified })
        .catch((): NeedsYouList => ({ items: [], failed: ['this list'] }))
    const initialConversation = conversationId ? await loadConversationView(me.id, conversationId) : null

    return (
        <AiPage
            initialConversation={initialConversation}
            historyPromise={historyPromise}
            needsYouPromise={needsYouPromise}
            firstName={me.name.split(/\s+/)[0] ?? ''}
            isAdmin={me.role === 'ADMIN'}
            web={webSearchEnabled()}
        />
    )
}
