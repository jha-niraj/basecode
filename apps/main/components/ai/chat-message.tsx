'use client'

import { memo } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertCircle, ArrowUpRight, Loader2, PanelRight } from 'lucide-react'
import { ReasoningSteps, type ReasoningStep } from '@repo/ui/components/ui/reasoning-steps'
import { Button } from '@repo/ui/components/ui/button'
import { ScrollArea } from '@repo/ui/components/ui/scroll-area'
import { AppLink } from '@repo/ui/components/app-link'
import type { ChatLink, MessagePart } from '@repo/ai/protocol'
import type { ChatViewMessage } from '@/lib/ai/types'
import { isPeekHref } from '@/lib/peeks/peek-routes'
import { CardRecord, TaskCard, TaskPointer, type ReplyFn } from './task-cards'

/**
 * One message. Links come from tools as structured `link` parts, never URLs the model typed: a `/peek/...` link
 * opens a quick look beside the chat; anything else is an in-app link. Nothing here may scroll sideways - tables
 * scroll inside their own box, every row is `min-w-0`.
 */

const md: Components = {
    p: ({ children }) => <p className="my-2 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    h1: ({ children }) => <p className="mb-1 mt-3 font-semibold">{children}</p>,
    h2: ({ children }) => <p className="mb-1 mt-3 font-semibold">{children}</p>,
    h3: ({ children }) => <p className="mb-1 mt-3 font-semibold">{children}</p>,
    code: ({ children }) => <code className="rounded bg-neutral-100 px-1 py-0.5 text-[0.85em] dark:bg-neutral-800">{children}</code>,
    pre: ({ children }) => (
        <ScrollArea orientation="horizontal" className="my-2 w-full min-w-0 rounded-lg bg-neutral-100 dark:bg-neutral-900">
            <pre className="p-3 text-xs">{children}</pre>
        </ScrollArea>
    ),
    // The model never writes links (the prompt says so); any it does write render as plain text, not navigation.
    a: ({ children }) => <span className="underline decoration-neutral-300 underline-offset-2">{children}</span>,
    table: ({ children }) => (
        <ScrollArea orientation="horizontal" className="my-2 w-full min-w-0 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="min-w-[28rem] text-left text-sm">{children}</table>
        </ScrollArea>
    ),
    th: ({ children }) => <th className="border-b border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">{children}</th>,
    td: ({ children }) => <td className="border-b border-neutral-100 px-3 py-1.5 dark:border-neutral-800/60">{children}</td>,
}

function LinkChip({ link, onOpenPeek }: { link: ChatLink; onOpenPeek: (href: string) => void }) {
    const cls = 'h-8 max-w-full cursor-pointer gap-1.5 truncate rounded-xl px-2.5 text-xs'
    if (isPeekHref(link.href)) {
        return (
            <Button type="button" size="sm" variant="outline" className={cls} onClick={() => onOpenPeek(link.href)} data-sheet-keep-open>
                <PanelRight className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{link.label}</span>
            </Button>
        )
    }
    return (
        <Button asChild size="sm" variant="outline" className={cls}>
            <AppLink href={link.href}><ArrowUpRight className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{link.label}</span></AppLink>
        </Button>
    )
}

export interface MessageProps {
    message: ChatViewMessage
    /** The latest assistant message - only its open cards are live; older open cards have "moved on". */
    isLatest: boolean
    /** `side`: open cards wait in the right column, the chat shows a pointer. `inline`: the card is drawn here. */
    surface: 'side' | 'inline'
    busy: boolean
    onReply: ReplyFn
    onOpenCard: (cardId: string) => void
    onOpenPeek: (href: string) => void
}

function partKey(p: MessagePart, i: number): string {
    if (p.type === 'tool') return `tool-${p.id}`
    if (p.type === 'card') return `card-${p.card.id}`
    return `${p.type}-${i}`
}

export const ChatMessage = memo(function ChatMessage({ message, isLatest, surface, busy, onReply, onOpenCard, onOpenPeek }: MessageProps) {
    if (message.role === 'user') {
        return (
            <div className="flex w-full min-w-0 justify-end">
                <div className="max-w-[85%] min-w-0 whitespace-pre-wrap break-words rounded-2xl bg-neutral-100 px-3.5 py-2 text-sm text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
                    {message.text}
                </div>
            </div>
        )
    }

    const links = message.parts.filter((p): p is Extract<MessagePart, { type: 'link' }> => p.type === 'link')
    const running = new Set(message.runningTools ?? [])
    const empty = !message.parts.some((p) => p.type !== 'link')
    // The turn's work, as gurukul shows it: one folded "N steps - 2.1s" row (open while it runs) holding
    // "Thought for 1.3s" (the model's own summarised thinking) and one line per tool call with its duration.
    const thoughtPart = message.parts.find((p): p is Extract<MessagePart, { type: 'thought' }> => p.type === 'thought')
    const steps: ReasoningStep[] = message.parts.flatMap((p) => p.type === 'tool'
        ? [{ id: p.id, label: p.label, name: p.name, status: running.has(p.id) ? 'running' as const : p.ok ? 'done' as const : 'error' as const, startedAt: p.startedAt, endedAt: p.endedAt }]
        : [])
    const thought = thoughtPart ? { text: thoughtPart.text, ms: thoughtPart.ms, active: !!message.thinking } : null
    const showSteps = steps.length > 0 || !!thought

    return (
        <div className="flex w-full min-w-0 flex-col items-stretch gap-2 text-sm text-neutral-900 dark:text-neutral-100">
            {message.pending && empty && (
                <div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking
                </div>
            )}
            {showSteps && <ReasoningSteps steps={steps} thought={thought} active={!!message.pending} className="min-w-0" />}
            {message.parts.map((p, i) => {
                const key = partKey(p, i)
                switch (p.type) {
                    case 'text':
                        return <div key={key} className="min-w-0 break-words"><ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>{p.text}</ReactMarkdown></div>
                    case 'tool':
                    case 'thought':
                        return null
                    case 'notice':
                        return (
                            <div key={key} className="flex min-w-0 items-start gap-1.5 text-xs text-neutral-700 dark:text-neutral-300">
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" /><span>{p.text}</span>
                            </div>
                        )
                    case 'card': {
                        const live = p.state === 'open' && isLatest
                        if (!live) return <CardRecord key={key} card={p.card} state={p.state} answer={p.answer} stale={p.state === 'open'} />
                        return surface === 'side'
                            ? <TaskPointer key={key} card={p.card} onOpen={() => onOpenCard(p.card.id)} />
                            : <TaskCard key={key} card={p.card} busy={busy} onReply={onReply} />
                    }
                    case 'link':
                        return null
                }
            })}
            {links.length > 0 && (
                <div className="flex min-w-0 flex-wrap gap-2">
                    {links.map((l, i) => <LinkChip key={`${l.link.href}-${i}`} link={l.link} onOpenPeek={onOpenPeek} />)}
                </div>
            )}
        </div>
    )
})
