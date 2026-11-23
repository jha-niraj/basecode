'use client'

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleDot, History, ListChecks, PanelRight, SquarePen } from 'lucide-react'
import { Page, type PageAction } from '@repo/ui/components/ui/page'
import { Button } from '@repo/ui/components/ui/button'
import { AppLink } from '@repo/ui/components/app-link'
import { ScrollArea } from '@repo/ui/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@repo/ui/components/ui/sheet'
import { cn } from '@repo/ui/lib/utils'
import { SITE } from '@repo/core/site'
import type { CardReply, ChatCard } from '@repo/ai/protocol'
import type { ConversationRow, ConversationView, NeedsYouList } from '@/lib/ai/types'
import { PEEK_PARAM } from '@/lib/peeks/peek-routes'
import { useAiChat } from '@/stores/ai-chat.store'
import { usePeekStore } from '@/stores/peek.store'
import { PeekBody, peekTitle } from '@/components/peeks/peek-view'
import { PeekActionsProvider } from '@/components/peeks/peek-context'
import { ChatFrame } from './chat-frame'
import { ChatWelcome } from './chat-welcome'
import { ChatMessage } from './chat-message'
import { ChatComposer } from './chat-composer'
import { SideColumn, type SideLayer, type SideTab } from './side-column'
import { HistoryFromPromise, HistorySkeleton } from './history-panel'
import { NeedsYouFromPromise, NeedsYouSkeleton } from './needs-you'
import { TaskCard, cardLabel } from './task-cards'
import { TranscriptSkeleton } from './ai-skeleton'
import { AI_NEEDS_YOU_KEY, CHAT_COLUMN, CHAT_COLUMN_STYLE, READING_MEASURE } from './query-keys'
import { useChat } from './use-chat'

/**
 * THE AI PAGE - the landing after sign-in. One screen:
 *
 *   wide (lg+):  [ chat column: header, frame, welcome | transcript, composer ][ right column ]
 *   below lg:    the chat alone; cards inline; History, Needs you and peeks in sheets
 *
 * The right column holds, one at a time: a card the AI waits on (a LAYER, with a one-line pointer in the chat), a peek
 * (a LAYER), else the tabs Needs you | History. A new card comes to the top and opens the column; opening a peek steps
 * the card down, and an amber line over the tabs keeps it reachable. Every press goes through the ONE `send`.
 */

const COLUMN_OPEN_KEY = 'app.ai.column-open'

function useIsWide(): boolean {
    const [wide, setWide] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)')
        const on = () => setWide(mq.matches)
        on()
        mq.addEventListener('change', on)
        return () => mq.removeEventListener('change', on)
    }, [])
    return wide
}

export function AiPage({
    initialConversation,
    historyPromise,
    needsYouPromise,
    firstName,
    isAdmin,
    web,
}: {
    initialConversation: ConversationView | null
    historyPromise: Promise<ConversationRow[]>
    needsYouPromise: Promise<NeedsYouList>
    firstName: string
    isAdmin: boolean
    web: boolean
}) {
    const isWide = useIsWide()
    const { send, stop, newChat, openConversation } = useChat()

    // ── Store, seeded once per arrival (the page component is the only writer of the initial state). ──
    const [ready, setReady] = useState(false)
    useEffect(() => {
        const st = useAiChat.getState()
        if (initialConversation) st.load(initialConversation)
        else {
            st.reset()
            // A chat URL whose chat is gone (deleted, or another account's) becomes a new chat at /ai.
            if (window.location.pathname !== '/ai') window.history.replaceState(window.history.state, '', '/ai')
        }
        usePeekStore.getState().close()
        setReady(true)
        // Only on arrival: later changes come from this page itself.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const storeMessages = useAiChat((s) => s.messages)
    const storeConversationId = useAiChat((s) => s.conversationId)
    const storeTitle = useAiChat((s) => s.title)
    const status = useAiChat((s) => s.status)
    const note = useAiChat((s) => s.note)
    const noteAction = useAiChat((s) => s.noteAction)
    const loadingConversation = useAiChat((s) => s.loadingConversation)
    const messages = ready ? storeMessages : initialConversation?.messages ?? []
    const conversationId = ready ? storeConversationId : initialConversation?.id ?? null
    const title = (ready ? storeTitle : initialConversation?.title) || `${SITE.name} AI`
    const streaming = status === 'streaming'
    const showWelcome = !loadingConversation && messages.length === 0 && !conversationId

    // ── Composer ──
    const [draft, setDraft] = useState('')
    const composerRef = useRef<HTMLTextAreaElement | null>(null)
    const submit = useCallback(() => {
        const text = draft.trim()
        if (!text || useAiChat.getState().status === 'streaming') return
        setDraft('')
        void send({ content: text })
    }, [draft, send])
    const sendPrompt = useCallback((text: string) => { void send({ content: text }) }, [send])
    const seed = useCallback((text: string) => {
        setDraft(text)
        requestAnimationFrame(() => {
            const el = composerRef.current
            if (el) { el.focus(); el.setSelectionRange(text.length, text.length) }
        })
    }, [])
    const onReply = useCallback((r: CardReply) => {
        void send({ content: r.content, display: r.display, reply: { answerTo: r.answerTo, decision: r.decision } })
    }, [send])
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); composerRef.current?.focus() }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [])

    // ── Transcript scroll: follow the reply while the reader is near the bottom. ──
    const viewportRef = useRef<HTMLDivElement | null>(null)
    const nearBottom = useRef(true)
    useEffect(() => {
        const el = viewportRef.current
        if (!el) return
        const onScroll = () => { nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120 }
        el.addEventListener('scroll', onScroll, { passive: true })
        return () => el.removeEventListener('scroll', onScroll)
    }, [])
    useEffect(() => {
        const el = viewportRef.current
        if (el && nearBottom.current) el.scrollTo({ top: el.scrollHeight })
    }, [messages])

    // ── Cards waiting on the person (open cards on the latest assistant message). ──
    const latestAssistantId = useMemo(() => [...messages].reverse().find((m) => m.role === 'assistant')?.id ?? null, [messages])
    const openCards: ChatCard[] = useMemo(() => {
        const m = messages.find((x) => x.id === latestAssistantId)
        return m ? m.parts.flatMap((p) => (p.type === 'card' && p.state === 'open' ? [p.card] : [])) : []
    }, [messages, latestAssistantId])
    const waitingKey = openCards.map((c) => c.id).join('|')

    // ── Right column state (wide only - a remembered "open" must never throw a sheet over a phone). ──
    const [columnOpen, setColumnOpen] = useState(true)
    const [tab, setTab] = useState<SideTab>('needs')
    const [taskOnTop, setTaskOnTop] = useState(false)
    const [focusedCard, setFocusedCard] = useState<string | null>(null)
    useEffect(() => {
        if (!isWide) return
        try { if (window.localStorage.getItem(COLUMN_OPEN_KEY) === '0') setColumnOpen(false) } catch { /* default open */ }
    }, [isWide])
    const setColumn = useCallback((open: boolean) => {
        setColumnOpen(open)
        try { window.localStorage.setItem(COLUMN_OPEN_KEY, open ? '1' : '0') } catch { /* not remembered */ }
    }, [])
    // A NEW card comes to the top and opens the column (also when the person had closed it).
    const seen = useRef<Set<string>>(new Set())
    useEffect(() => {
        if (!openCards.length) { setTaskOnTop(false); return }
        const fresh = openCards.filter((c) => !seen.current.has(c.id))
        openCards.forEach((c) => seen.current.add(c.id))
        if (fresh.length) {
            setFocusedCard(fresh[0]!.id)
            setTaskOnTop(true)
            if (isWide) setColumnOpen(true)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [waitingKey])

    // ── Peeks: one stack; the column hosts it on wide screens, a bottom sheet below lg. ──
    const stack = usePeekStore((s) => s.stack)
    const openPeekStore = usePeekStore((s) => s.open)
    const peekBack = usePeekStore((s) => s.back)
    const peekClose = usePeekStore((s) => s.close)
    const setColumnHost = usePeekStore((s) => s.setColumnHost)
    const topPeek = stack[stack.length - 1] ?? null
    useEffect(() => { setColumnHost(isWide); return () => setColumnHost(false) }, [isWide, setColumnHost])
    // What a peek did may have finished a Needs you row: refetch the list when the stack empties.
    const queryClient = useQueryClient()
    const hadPeek = useRef(false)
    useEffect(() => {
        if (topPeek) hadPeek.current = true
        else if (hadPeek.current) { hadPeek.current = false; void queryClient.invalidateQueries({ queryKey: AI_NEEDS_YOU_KEY }) }
    }, [topPeek, queryClient])
    const openPeek = useCallback((href: string) => {
        openPeekStore(href, { fresh: true })
        setTaskOnTop(false)
        if (isWide) setColumnOpen(true)
    }, [openPeekStore, isWide])
    // ?peek= : read ONCE on arrival, then written on every change with replaceState (never router.replace).
    const peekRead = useRef(false)
    useEffect(() => {
        const v = new URLSearchParams(window.location.search).get(PEEK_PARAM)
        if (v) openPeekStore(v.startsWith('/') ? v : `/${v}`, { fresh: true })
        peekRead.current = true
    }, [openPeekStore])
    useEffect(() => {
        if (!peekRead.current) return
        const url = new URL(window.location.href)
        if (topPeek) url.searchParams.set(PEEK_PARAM, topPeek.replace(/^\//, ''))
        else url.searchParams.delete(PEEK_PARAM)
        if (url.toString() !== window.location.href) window.history.replaceState(window.history.state, '', url.toString())
    }, [topPeek])

    // ── Header height, measured, so the column's header rule meets the chat's frame rule. ──
    const rowRef = useRef<HTMLDivElement | null>(null)
    const bodyRef = useRef<HTMLDivElement | null>(null)
    const [headerHeight, setHeaderHeight] = useState<number | undefined>(undefined)
    useLayoutEffect(() => {
        const row = rowRef.current
        const body = bodyRef.current
        if (!row || !body) return
        const measure = () => setHeaderHeight(body.getBoundingClientRect().top - row.getBoundingClientRect().top)
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(row)
        ro.observe(body)
        return () => ro.disconnect()
    }, [isWide])

    // ── Phone sheets ──
    const [historySheet, setHistorySheet] = useState(false)
    const [needsSheet, setNeedsSheet] = useState(false)

    const showTab = useCallback((t: SideTab) => {
        if (isWide) { setTab(t); setColumn(true); setTaskOnTop(false); peekClose() }
        else if (t === 'history') setHistorySheet(true)
        else setNeedsSheet(true)
    }, [isWide, setColumn, peekClose])

    const selectConversation = useCallback((id: string) => {
        setHistorySheet(false)
        void openConversation(id)
    }, [openConversation])
    const onDeleted = useCallback((id: string) => {
        if (useAiChat.getState().conversationId === id) newChat()
    }, [newChat])

    const surface: 'side' | 'inline' = isWide && columnOpen ? 'side' : 'inline'

    // ── The column's layer ──
    const card = openCards.find((c) => c.id === focusedCard) ?? openCards[0] ?? null
    const layer: SideLayer | null = taskOnTop && card
        ? {
            key: `card-${card.id}`,
            title: cardLabel(card),
            body: (
                <ScrollArea orientation="vertical" className="min-h-0 flex-1">
                    <div className="flex min-w-0 flex-col gap-3 p-3">
                        {openCards.map((c) => <TaskCard key={c.id} card={c} busy={streaming} onReply={onReply} />)}
                    </div>
                </ScrollArea>
            ),
            onBack: () => setTaskOnTop(false),
        }
        : topPeek
            ? {
                key: `peek-${topPeek}`,
                title: peekTitle(topPeek),
                body: <PeekBody href={topPeek} />,
                onBack: stack.length > 1 ? peekBack : peekClose,
                onClose: peekClose,
            }
            : null
    const waiting = card && !taskOnTop ? (
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-xs dark:border-neutral-800">
            <CircleDot className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300">{cardLabel(card)} - waiting for you</span>
            <Button type="button" size="sm" variant="ghost" className="h-7 shrink-0 cursor-pointer rounded-lg px-2 text-xs" onClick={() => { peekClose(); setTaskOnTop(true) }}>Open</Button>
        </div>
    ) : null

    const actions: PageAction[] = isWide
        ? [
            { key: 'side', label: columnOpen ? 'Hide side panel' : 'Show side panel', icon: <PanelRight className="h-4 w-4" />, variant: 'ghost', onClick: () => setColumn(!columnOpen) },
            { key: 'history', label: 'History', icon: <History className="h-4 w-4" />, variant: 'ghost', onClick: () => showTab('history') },
            { key: 'new', label: 'New chat', icon: <SquarePen className="h-4 w-4" />, primary: true, variant: 'outline', onClick: newChat },
        ]
        : [
            { key: 'needs', label: 'Needs you', icon: <ListChecks className="h-4 w-4" />, variant: 'ghost', onClick: () => setNeedsSheet(true) },
            { key: 'history', label: 'History', icon: <History className="h-4 w-4" />, variant: 'ghost', onClick: () => setHistorySheet(true) },
            { key: 'new', label: 'New chat', icon: <SquarePen className="h-4 w-4" />, primary: true, variant: 'outline', onClick: newChat },
        ]

    const historyBody = (
        <Suspense fallback={<HistorySkeleton />}>
            <HistoryFromPromise promise={historyPromise} currentId={conversationId} onSelect={selectConversation} onDeleted={onDeleted} />
        </Suspense>
    )
    const needsBody = (
        <Suspense fallback={<NeedsYouSkeleton />}>
            <NeedsYouFromPromise promise={needsYouPromise} onOpenPeek={(href) => { setNeedsSheet(false); openPeek(href) }} />
        </Suspense>
    )

    return (
        <PeekActionsProvider value={{ ask: sendPrompt }}>
            <div ref={rowRef} className="flex h-[var(--app-page-h)] min-h-0 w-full min-w-0 overflow-hidden">
                <div className={cn(CHAT_COLUMN, 'relative')} style={CHAT_COLUMN_STYLE}>
                    {isWide && <ChatFrame ruleTop={headerHeight} />}
                    <Page title={title} actions={actions} bleed body="fill" bodyClassName="gap-0" className="[&>[data-page-header]]:px-4">
                        <div ref={bodyRef} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                            <ScrollArea orientation="vertical" className="min-h-0 min-w-0 flex-1" viewportRef={viewportRef}>
                                {showWelcome ? (
                                    <ChatWelcome firstName={firstName} isAdmin={isAdmin} web={web} busy={streaming} onPrompt={sendPrompt} onSeed={seed} onTab={showTab} />
                                ) : loadingConversation ? (
                                    <TranscriptSkeleton />
                                ) : (
                                    <div className={cn('mx-auto flex w-full min-w-0 flex-col gap-5 px-3 py-6 sm:px-6', READING_MEASURE)}>
                                        {messages.map((m) => (
                                            <ChatMessage
                                                key={m.id}
                                                message={m}
                                                isLatest={m.id === latestAssistantId}
                                                surface={surface}
                                                busy={streaming}
                                                onReply={onReply}
                                                onOpenCard={(id) => { setFocusedCard(id); setTaskOnTop(true); peekClose(); setColumn(true) }}
                                                onOpenPeek={openPeek}
                                            />
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                            {note && (
                                <div role="status" className={cn('mx-auto flex w-full min-w-0 items-center justify-between gap-3 px-6 pb-2 text-sm text-neutral-700 dark:text-neutral-300', READING_MEASURE)}>
                                    <p className="min-w-0">{note}</p>
                                    {noteAction && (
                                        <Button asChild size="sm" variant="outline" className="shrink-0 rounded-xl">
                                            <AppLink href={noteAction.href}>{noteAction.label}</AppLink>
                                        </Button>
                                    )}
                                </div>
                            )}
                            <ChatComposer ref={composerRef} value={draft} onChange={setDraft} onSend={submit} onStop={stop} streaming={streaming} />
                        </div>
                    </Page>
                </div>

                {isWide && (
                    <SideColumn
                        open={columnOpen}
                        tab={tab}
                        onTab={(t) => { setTab(t); peekClose() }}
                        onClose={() => setColumn(false)}
                        layer={layer}
                        needs={needsBody}
                        history={historyBody}
                        waiting={waiting}
                        headerHeight={headerHeight}
                    />
                )}
            </div>

            {!isWide && (
                <>
                    <Sheet open={historySheet} onOpenChange={setHistorySheet}>
                        <SheetContent side="right" resizable={false} className="flex h-[100dvh] w-full flex-col gap-0 p-0 sm:max-w-md">
                            <SheetTitle className="px-4 pb-1 pt-4 text-base">History</SheetTitle>
                            <SheetDescription className="sr-only">Your earlier chats</SheetDescription>
                            {historyBody}
                        </SheetContent>
                    </Sheet>
                    <Sheet open={needsSheet} onOpenChange={setNeedsSheet}>
                        <SheetContent side="bottom" resizable={false} className="flex h-[80dvh] flex-col gap-0 rounded-t-2xl p-0">
                            <SheetTitle className="px-4 pb-1 pt-4 text-base">Needs you</SheetTitle>
                            <SheetDescription className="sr-only">What needs you now</SheetDescription>
                            {needsBody}
                        </SheetContent>
                    </Sheet>
                    <Sheet open={!!topPeek} onOpenChange={(o) => { if (!o) peekClose() }}>
                        <SheetContent side="bottom" resizable={false} className="flex h-[88dvh] flex-col gap-0 rounded-t-2xl p-0">
                            <div className="flex min-w-0 shrink-0 items-center gap-2 px-4 pt-4">
                                {stack.length > 1 && <Button type="button" variant="ghost" size="sm" className="h-8 cursor-pointer rounded-lg px-2 text-xs" onClick={peekBack}>Back</Button>}
                                <SheetTitle className="min-w-0 flex-1 truncate text-base">{topPeek ? peekTitle(topPeek) : 'Quick look'}</SheetTitle>
                            </div>
                            <SheetDescription className="sr-only">A quick look at a record</SheetDescription>
                            {topPeek && <PeekBody href={topPeek} />}
                        </SheetContent>
                    </Sheet>
                </>
            )}
        </PeekActionsProvider>
    )
}
