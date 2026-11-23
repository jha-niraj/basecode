'use server'

// Every export here is a public endpoint: each checks the session itself and filters by the signed-in person.
// Only async functions are exported (anything else empties the module at build).
import { z } from 'zod'
import { ok, fail, failWith, type ActionResult } from '@repo/errors'
import { db, and, eq } from '@repo/db'
import { aiConversations } from '@repo/db/schema'
import { getSession } from '@/lib/session'
import { listConversationsFor, loadConversationView, needsYouFor, userPeekFor } from '@/lib/ai/conversations'
import type { ConversationRow, ConversationView, NeedsYouList, UserPeekData } from '@/lib/ai/types'

const idSchema = z.string().min(1).max(100)

export async function listConversations(): Promise<ActionResult<ConversationRow[]>> {
    try {
        const s = await getSession()
        if (!s) return failWith('auth', 'Your session ended. Sign in again.')
        return ok(await listConversationsFor(s.user.id))
    } catch (err) {
        return fail(err)
    }
}

export async function getConversation(id: string): Promise<ActionResult<ConversationView>> {
    try {
        const s = await getSession()
        if (!s) return failWith('auth', 'Your session ended. Sign in again.')
        const parsed = idSchema.safeParse(id)
        if (!parsed.success) return failWith('validation', 'That chat could not be found.')
        const view = await loadConversationView(s.user.id, parsed.data)
        return view ? ok(view) : failWith('notfound', 'That chat could not be found. It may have been deleted.')
    } catch (err) {
        return fail(err)
    }
}

export async function renameConversation(id: string, title: string): Promise<ActionResult<null>> {
    try {
        const s = await getSession()
        if (!s) return failWith('auth', 'Your session ended. Sign in again.')
        const t = title.trim().slice(0, 120)
        if (!idSchema.safeParse(id).success || !t) return failWith('validation', 'Give the chat a name.')
        await db.update(aiConversations).set({ title: t })
            .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, s.user.id)))
        return ok(null)
    } catch (err) {
        return fail(err)
    }
}

export async function deleteConversation(id: string): Promise<ActionResult<null>> {
    try {
        const s = await getSession()
        if (!s) return failWith('auth', 'Your session ended. Sign in again.')
        if (!idSchema.safeParse(id).success) return failWith('validation', 'That chat could not be found.')
        await db.delete(aiConversations).where(and(eq(aiConversations.id, id), eq(aiConversations.userId, s.user.id)))
        return ok(null)
    } catch (err) {
        return fail(err)
    }
}

export async function getNeedsYou(): Promise<ActionResult<NeedsYouList>> {
    try {
        const s = await getSession()
        if (!s) return failWith('auth', 'Your session ended. Sign in again.')
        return ok(await needsYouFor({ id: s.user.id, role: s.user.role, emailVerified: s.user.emailVerified }))
    } catch (err) {
        return fail(err)
    }
}

export async function getUserPeek(id: string): Promise<ActionResult<UserPeekData>> {
    try {
        const s = await getSession()
        if (!s) return failWith('auth', 'Your session ended. Sign in again.')
        if (!idSchema.safeParse(id).success) return failWith('notfound', 'That person could not be found.')
        const data = await userPeekFor({ id: s.user.id, role: s.user.role }, id)
        return data ? ok(data) : failWith('notfound', 'That person could not be found, or you cannot see them.')
    } catch (err) {
        return fail(err)
    }
}
