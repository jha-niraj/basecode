'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, MessagesSquare } from 'lucide-react'
import { ChatStart } from '@repo/ui/components/chat-start'
import { cn } from '@repo/ui/lib/utils'
import { askRowsFor, createCardsFor, type CreateCard } from './welcome-config'
import { READING_MEASURE } from './query-keys'

/**
 * The welcome - a NEW chat only (no messages, nothing loading). Gone the moment the first message exists.
 * The greeting is resolved AFTER mount: reading the clock during render is a hydration mismatch at 11:59.
 */
function useGreeting(): string {
    const [part, setPart] = useState('Welcome back')
    useEffect(() => {
        const h = new Date().getHours()
        setPart(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening')
    }, [])
    return part
}

export function ChatWelcome({
    firstName,
    isAdmin,
    web,
    busy,
    onPrompt,
    onSeed,
    onTab,
}: {
    firstName: string
    isAdmin: boolean
    web: boolean
    busy: boolean
    onPrompt: (text: string) => void
    onSeed: (text: string) => void
    onTab: (tab: 'needs' | 'history') => void
}) {
    const greeting = useGreeting()
    const cards = createCardsFor({ isAdmin, web })
    const asks = askRowsFor({ isAdmin })
    const press = (c: CreateCard) => {
        if (c.tab) onTab(c.tab)
        else if (c.seed) onSeed(c.seed)
        else if (c.prompt) onPrompt(c.prompt)
    }

    return (
        // The shared start screen (packages/ui chat-start.tsx, after runable.com - owner, 2026-11-23): the mark, greeting
        // and question, 4 create tiles (icon and text in one row), then 2 questions with no header. The composer stays
        // pinned at the bottom by the page.
        <div className={cn('relative mx-auto w-full min-w-0', READING_MEASURE)}>
            {/* Dot grid behind the mark and greeting only, fading down. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle,rgb(0_0_0/0.09)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_top,black_15%,transparent_70%)] dark:bg-[radial-gradient(circle,rgb(255_255_255/0.08)_1px,transparent_1px)]"
            />
            <ChatStart
                className="relative"
                busy={busy}
                mark={
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900">
                        <MessagesSquare className="h-5 w-5" />
                    </span>
                }
                greeting={`${greeting}${firstName ? `, ${firstName}` : ''}`}
                question="What would you like to look up or get done?"
                groups={[
                    {
                        key: 'create', label: 'Create', layout: 'tiles',
                        items: cards.slice(0, 4).map((c) => {
                            const Icon = c.icon
                            return { key: c.id, title: c.label, description: c.hint, icon: <Icon className="text-neutral-600 dark:text-neutral-300" />, onSelect: () => press(c) }
                        }),
                    },
                    {
                        key: 'ask', layout: 'rows',
                        items: asks.slice(0, 2).map((a) => ({ key: a.id, title: a.text, icon: <MessageCircle />, onSelect: () => onPrompt(a.text) })),
                    },
                ]}
            />
        </div>
    )
}
