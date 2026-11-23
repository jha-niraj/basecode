'use client'

import { useState } from 'react'
import { ArrowLeft, Check, CircleDot, PanelRight } from 'lucide-react'
import { Button } from '@repo/ui/components/ui/button'
import { Input } from '@repo/ui/components/ui/input'
import { Textarea } from '@repo/ui/components/ui/textarea'
import { cn } from '@repo/ui/lib/utils'
import type { CardReply, CardState, ChatCard, ChatConfirmCard, ChatFormCard, ChatQuestionCard } from '@repo/ai/protocol'
import { useAiChat } from '@/stores/ai-chat.store'

/**
 * The three cards - a question set (stepped, one at a time), a confirmation and a form. A card is a helping hand,
 * never a blocker: it never disables or covers the composer, and typing instead always works.
 *
 * Pressing a card button SENDS A MESSAGE (`onReply`), it never performs the write. Each reply carries two strings:
 * `content` for the model (it names what to do, so no second identical card appears) and `display` for the bubble.
 * A card locks once decided or once the conversation moved past it (`stale`).
 */

export type ReplyFn = (reply: CardReply) => void

export function cardLabel(card: ChatCard): string {
    if (card.kind === 'question') return card.questions.length === 1 ? card.title : `${card.questions.length} questions - ${card.title}`
    if (card.kind === 'confirm') return `Confirm: ${card.title}`
    return card.title
}

const STATE_WORD: Record<Exclude<CardState, 'open'>, string> = {
    answered: 'Answered',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    submitted: 'Saved',
}

const CARD_BOX = 'w-full min-w-0 max-w-full rounded-xl border border-neutral-200 bg-white p-3.5 dark:border-neutral-800 dark:bg-neutral-900'

/** A decided (or stale) card, folded to one line. */
export function CardRecord({ card, state, answer, stale }: { card: ChatCard; state: CardState; answer?: string; stale?: boolean }) {
    const word = state === 'open' ? (stale ? 'Moved on' : 'Waiting') : STATE_WORD[state]
    return (
        <div className="flex w-full min-w-0 items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 truncate"><span className="font-medium text-neutral-800 dark:text-neutral-200">{word}</span> - {cardLabel(card)}{answer ? ` - ${answer}` : ''}</span>
        </div>
    )
}

/** The one line in the chat while the card waits in the right column. */
export function TaskPointer({ card, onOpen }: { card: ChatCard; onOpen: () => void }) {
    return (
        <div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            <CircleDot className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300">
                {cardLabel(card)} <span className="text-neutral-600 dark:text-neutral-400">- waiting for you on the right</span>
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={onOpen} className="h-7 shrink-0 cursor-pointer gap-1 rounded-lg px-2 text-xs">
                <PanelRight className="h-3.5 w-3.5" /> Open
            </Button>
        </div>
    )
}

export function TaskCard({ card, busy, onReply }: { card: ChatCard; busy: boolean; onReply: ReplyFn }) {
    if (card.kind === 'question') return <QuestionCard card={card} busy={busy} onReply={onReply} />
    if (card.kind === 'confirm') return <ConfirmCard card={card} busy={busy} onReply={onReply} />
    return <FormCard card={card} busy={busy} onReply={onReply} />
}

// ─── Questions, stepped ───────────────────────────────────────────────────────

function QuestionCard({ card, busy, onReply }: { card: ChatQuestionCard; busy: boolean; onReply: ReplyFn }) {
    const values = useAiChat((s) => s.formValues[card.id])
    const setValue = useAiChat((s) => s.setFormValue)
    const [step, setStep] = useState(0)
    const q = card.questions[Math.min(step, card.questions.length - 1)]!
    const last = step >= card.questions.length - 1
    const value = values?.[q.id] ?? ''
    const picked = value ? value.split('\n') : []

    const submit = () => {
        const lines = card.questions.map((x) => ({ prompt: x.prompt, answer: (values?.[x.id] ?? '').split('\n').filter(Boolean).join(', ') || 'no answer' }))
        onReply({
            answerTo: card.id,
            decision: 'answered',
            content: `My answers to "${card.title}":\n${lines.map((l) => `- ${l.prompt}: ${l.answer}`).join('\n')}`,
            display: lines.map((l) => l.answer).join(' / '),
        })
    }
    const next = () => (last ? submit() : setStep(step + 1))
    const pick = (option: string) => {
        if (q.multi) {
            const set = new Set(picked)
            if (set.has(option)) set.delete(option)
            else set.add(option)
            setValue(card.id, q.id, [...set].join('\n'))
        } else {
            setValue(card.id, q.id, option)
            if (!last) setStep(step + 1)
        }
    }

    return (
        <div className={CARD_BOX}>
            <div className="flex min-w-0 items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs text-neutral-600 dark:text-neutral-400">{card.title}</p>
                {card.questions.length > 1 && <span className="shrink-0 text-xs text-neutral-600 dark:text-neutral-400">{step + 1} of {card.questions.length}</span>}
            </div>
            <p className="mt-1.5 text-sm font-medium text-neutral-900 dark:text-neutral-100">{q.prompt}</p>
            {q.kind === 'choice' && q.options?.length ? (
                <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                    {q.options.map((o) => (
                        <Button
                            key={o}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => pick(o)}
                            className={cn('h-8 max-w-full cursor-pointer truncate rounded-xl text-xs', picked.includes(o) && 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white dark:border-white dark:bg-white dark:text-neutral-900')}
                        >
                            {o}
                        </Button>
                    ))}
                </div>
            ) : (
                <Input
                    className="mt-3 rounded-xl"
                    value={value}
                    maxLength={500}
                    placeholder="Type your answer"
                    onChange={(e) => setValue(card.id, q.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); next() } }}
                />
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
                <Button type="button" size="sm" variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)} className="h-8 cursor-pointer gap-1 rounded-xl px-2 text-xs">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
                {(last || q.kind === 'text' || q.multi) && (
                    <Button type="button" size="sm" disabled={busy} onClick={next} className="h-8 cursor-pointer rounded-xl text-xs">
                        {last ? 'Send answers' : 'Next'}
                    </Button>
                )}
            </div>
        </div>
    )
}

// ─── Confirmation ─────────────────────────────────────────────────────────────

function ConfirmCard({ card, busy, onReply }: { card: ChatConfirmCard; busy: boolean; onReply: ReplyFn }) {
    return (
        <div className={CARD_BOX}>
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{card.title}</p>
            {card.summary && <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">{card.summary}</p>}
            {card.items && card.items.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
                    {card.items.map((it) => <li key={it} className="min-w-0 truncate">- {it}</li>)}
                </ul>
            )}
            <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                    type="button" size="sm" variant="ghost" disabled={busy} className="h-8 cursor-pointer rounded-xl text-xs"
                    onClick={() => onReply({ answerTo: card.id, decision: 'cancelled', content: `Cancelled: ${card.title}. Do not do it.`, display: 'No, cancel that.' })}
                >
                    Cancel
                </Button>
                <Button
                    type="button" size="sm" disabled={busy} className="h-8 cursor-pointer rounded-xl text-xs"
                    onClick={() => onReply({
                        answerTo: card.id,
                        decision: 'confirmed',
                        content: `Confirmed: ${card.title}. Go ahead now - call the write tool with confirmed=true. Do not show me another confirmation.`,
                        display: `Yes - ${card.confirmLabel.toLowerCase()}.`,
                    })}
                >
                    {card.confirmLabel}
                </Button>
            </div>
        </div>
    )
}

// ─── Form (values held in the store, so they survive the column closing) ──────

function FormCard({ card, busy, onReply }: { card: ChatFormCard; busy: boolean; onReply: ReplyFn }) {
    const values = useAiChat((s) => s.formValues[card.id])
    const setValue = useAiChat((s) => s.setFormValue)
    const valueOf = (name: string) => values?.[name] ?? card.fields.find((f) => f.name === name)?.value ?? ''
    const first = card.fields[0]
    const canSave = !!first && valueOf(first.name).trim() !== ''

    const submit = () => {
        const data = Object.fromEntries(card.fields.map((f) => [f.name, valueOf(f.name)]))
        onReply({
            answerTo: card.id,
            decision: 'submitted',
            content: `I submitted the form "${card.title}". Save it now with confirmed=true and exactly these values:\n${JSON.stringify(data)}`,
            display: `${card.submitLabel}: ${first ? valueOf(first.name) : ''}`.trim(),
        })
    }

    return (
        <form className={cn(CARD_BOX, 'space-y-3')} onSubmit={(e) => { e.preventDefault(); if (canSave) submit() }}>
            {card.fields.map((f) => (
                <label key={f.name} className="block min-w-0 space-y-1.5">
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{f.label}</span>
                    {f.kind === 'textarea' ? (
                        <Textarea
                            value={valueOf(f.name)}
                            maxLength={f.maxLength}
                            onChange={(e) => setValue(card.id, f.name, e.target.value)}
                            className="min-h-28 rounded-xl [field-sizing:content] max-h-80 resize-none"
                        />
                    ) : (
                        <Input value={valueOf(f.name)} maxLength={f.maxLength} onChange={(e) => setValue(card.id, f.name, e.target.value)} className="rounded-xl" />
                    )}
                </label>
            ))}
            <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={busy || !canSave} className="h-8 cursor-pointer rounded-xl text-xs">{card.submitLabel}</Button>
            </div>
        </form>
    )
}
