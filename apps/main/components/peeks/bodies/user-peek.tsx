'use client'

import { use } from 'react'
import { Mail, MessageSquarePlus } from 'lucide-react'
import { Button } from '@repo/ui/components/ui/button'
import { Skeleton } from '@repo/ui/components/ui/skeleton'
import { getUserPeek } from '@/actions/ai/ai.action'
import { PeekShell, PeekShellSkeleton } from '../peek-shell'
import { cachedRead } from '../later'
import { usePeekActions } from '../peek-context'

/**
 * EXAMPLE peek: one person - name, email, when they joined, sign-ins in windows, notes. The read is a server action
 * with its own session check (admins see anyone, others only themselves): a peek is a new door to the same data.
 */
export function UserPeekBody({ id }: { id: string }) {
    // Started once per id, outside render's update path, cached outside the component (see ../later.ts).
    const res = use(cachedRead(`user:${id}`, () => getUserPeek(id)))
    const { ask } = usePeekActions()

    if (!res.success) {
        return <PeekShell title="Person" subtitle={res.error ?? 'Could not load this person.'} />
    }
    const u = res.data
    const joined = new Date(u.joinedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    return (
        <PeekShell
            title={u.name}
            subtitle={u.email}
            image={u.image}
            stats={[
                { label: 'Joined', value: joined },
                { label: 'Email', value: u.emailVerified ? 'Verified' : 'Not verified' },
                { label: 'Sign-ins, last 7 days', value: String(u.signIns.last7) },
                { label: 'Sign-ins, last 30 days', value: String(u.signIns.last30) },
                { label: 'Notes, all time', value: String(u.notes) },
            ]}
            footer={
                <>
                    <Button type="button" size="sm" className="h-8 min-w-0 cursor-pointer gap-1.5 rounded-xl text-xs" onClick={() => ask(`Tell me about ${u.name}'s activity.`)}>
                        <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Ask about them</span>
                    </Button>
                    <Button asChild type="button" size="sm" variant="outline" className="h-8 min-w-0 cursor-pointer gap-1.5 rounded-xl text-xs">
                        <a href={`mailto:${u.email}`}><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Email</span></a>
                    </Button>
                </>
            }
        />
    )
}

export function UserPeekSkeleton() {
    return <PeekShellSkeleton rows={5} withImage><Skeleton className="h-8 w-32 rounded-xl" /></PeekShellSkeleton>
}
