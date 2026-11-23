'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, MessagesSquare } from 'lucide-react'
import { Button } from '@repo/ui/components/ui/button'
import { cn } from '@repo/ui/lib/utils'
import { SITE } from '@repo/core/site'
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
        <div className={cn('relative mx-auto w-full min-w-0 px-3 pb-6 pt-10 sm:px-6', READING_MEASURE)}>
            {/* Dot grid behind the mark and greeting only, fading down. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle,rgb(0_0_0/0.09)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(ellipse_at_top,black_15%,transparent_70%)] dark:bg-[radial-gradient(circle,rgb(255_255_255/0.08)_1px,transparent_1px)]"
            />
            <div className="relative flex flex-col items-center text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900">
                    <MessagesSquare className="h-5 w-5" />
                </div>
                <h2 suppressHydrationWarning className="mt-4 text-xl font-semibold text-neutral-900 dark:text-white">
                    {greeting}{firstName ? `, ${firstName}` : ''}
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">What would you like to look up or get done?</p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                    You&apos;re on {SITE.name} AI
                </span>
            </div>

            <section className="relative mt-8">
                <h3 className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">Create</h3>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    {cards.map((c, i) => {
                        const Icon = c.icon
                        const wide = cards.length % 2 === 1 && i === cards.length - 1
                        return (
                            <Button
                                key={c.id}
                                type="button"
                                variant="ghost"
                                disabled={busy && !c.tab}
                                onClick={() => press(c)}
                                className={cn(
                                    'group h-auto min-w-0 cursor-pointer justify-start gap-3 rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/60 dark:hover:border-neutral-700 dark:hover:bg-neutral-900/60',
                                    wide && 'sm:col-span-2',
                                )}
                            >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{c.label}</span>
                                    <span className="block truncate text-xs font-normal text-neutral-600 dark:text-neutral-400">{c.hint}</span>
                                </span>
                                <ArrowUpRight className="h-4 w-4 shrink-0 text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100" />
                            </Button>
                        )
                    })}
                </div>
            </section>

            <section className="relative mt-6">
                <h3 className="mb-2 text-xs font-medium text-neutral-600 dark:text-neutral-400">Ask</h3>
                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    {asks.map((a) => (
                        <Button
                            key={a.id}
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => onPrompt(a.text)}
                            className="h-auto min-w-0 cursor-pointer justify-start whitespace-normal rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-left text-sm font-normal text-neutral-700 hover:border-neutral-300 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300 dark:hover:bg-neutral-900/60"
                        >
                            {a.text}
                        </Button>
                    ))}
                </div>
            </section>
        </div>
    )
}
