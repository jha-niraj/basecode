'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';

/**
 * A new chat's start screen, shared by Saathi (staff) and Vidya (students) - after runable.com's home (Niraj,
 * 2026-11-23: "clean ... keep the input box at the bottom"). The app keeps its composer pinned BELOW this; this is only
 * what fills the space above it:
 *
 *   the mark, a greeting, one muted question, where you are
 *   then groups - each a soft card with a header that folds (runable's Code / Productivity), or bare (no label):
 *     `tiles`: icon beside a title and one muted line - for things to MAKE
 *     `rows`:  icon + one line - for things to ASK
 *
 * Every item is a press that the app wires (send a prompt, open a sheet, start a make flow). No colour surfaces: the
 * cards are tone steps; an item's icon may carry its own colour (the datum carve-out).
 */
export interface ChatStartItem {
    key: string;
    title: string;
    /** One muted line under a tile's title. Rows ignore it. */
    description?: string;
    icon: React.ReactNode;
    onSelect: () => void;
    ariaLabel?: string;
}

export interface ChatStartGroup {
    key: string;
    /** Leave it out for a bare group: no card, no header - just its items (Saathi's two Ask rows under Create). */
    label?: string;
    layout: 'tiles' | 'rows';
    items: ChatStartItem[];
}

export function ChatStart({
    mark,
    greeting,
    question,
    context,
    groups,
    busy = false,
    compact = false,
    className,
}: {
    mark?: React.ReactNode;
    greeting: React.ReactNode;
    question: React.ReactNode;
    /** "You're on Homework" - a small pill under the question. */
    context?: React.ReactNode;
    groups: ChatStartGroup[];
    /** A turn is in flight: every item is disabled so a press cannot queue a second one. */
    busy?: boolean;
    /** The docked panel (~460px): one tile column and a smaller greeting. */
    compact?: boolean;
    className?: string;
}) {
    return (
        <div className={cn('mx-auto flex w-full min-w-0 flex-col', compact ? 'max-w-xl gap-5 px-4 py-6' : 'max-w-2xl gap-7 px-6 pb-8 pt-10', className)}>
            <div className="flex flex-col items-center gap-2 text-center">
                {mark ? <div className={compact ? 'mb-0.5' : 'mb-1.5'}>{mark}</div> : null}
                <h2
                    suppressHydrationWarning
                    className={cn(
                        'font-display text-balance font-semibold tracking-tight text-neutral-900 dark:text-neutral-50',
                        compact ? 'text-lg' : 'text-[28px] leading-tight',
                    )}
                >
                    {greeting}
                </h2>
                <p className={cn('text-neutral-500 dark:text-neutral-400', compact ? 'text-xs' : 'text-[15px]')}>{question}</p>
                {context ? (
                    <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-neutral-950/[0.04] px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-white/[0.06] dark:text-neutral-300">
                        {context}
                    </span>
                ) : null}
            </div>
            <div className="flex flex-col gap-3">
                {groups.filter((g) => g.items.length > 0).map((g) => (
                    <StartGroup key={g.key} group={g} busy={busy} compact={compact} />
                ))}
            </div>
        </div>
    );
}

function StartGroup({ group, busy, compact }: { group: ChatStartGroup; busy: boolean; compact: boolean }) {
    const [open, setOpen] = React.useState(true);
    const id = React.useId();
    const cols = compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2';
    if (!group.label) {
        // A bare group (Niraj, 2026-11-23: "remove this Ask") - its items sit under the card above, on the same inset.
        return (
            <div className={cn('grid gap-2 px-2.5', cols)}>
                {group.items.map((it) => group.layout === 'tiles'
                    ? <Tile key={it.key} item={it} busy={busy} />
                    : <Row key={it.key} item={it} busy={busy} />)}
            </div>
        );
    }
    return (
        <section className="rounded-2xl bg-neutral-950/[0.025] ring-1 ring-neutral-950/[0.05] dark:bg-white/[0.03] dark:ring-white/[0.06]">
            <Button
                type="button"
                variant="ghost"
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setOpen((v) => !v)}
                className="flex h-11 w-full items-center justify-between rounded-2xl px-4 text-sm font-medium text-neutral-800 hover:bg-transparent dark:text-neutral-100"
            >
                {group.label}
                <ChevronDown aria-hidden className={cn('size-4 text-neutral-400 transition-transform', !open && '-rotate-90')} />
            </Button>
            {open ? (
                <div
                    id={id}
                    className={cn('grid gap-2 px-2.5 pb-2.5', cols)}
                >
                    {group.items.map((it) => group.layout === 'tiles'
                        ? <Tile key={it.key} item={it} busy={busy} />
                        : <Row key={it.key} item={it} busy={busy} />)}
                </div>
            ) : null}
        </section>
    );
}

const ITEM = cn(
    'h-auto w-full min-w-0 justify-start whitespace-normal rounded-xl text-left font-normal transition-colors',
    'bg-white ring-1 ring-neutral-950/[0.05] hover:bg-neutral-50 dark:bg-white/[0.04] dark:ring-white/[0.06] dark:hover:bg-white/[0.07]',
);

/** A tile: the icon and the two lines side by side in ONE row, centred on each other, from the left (Niraj, 2026-11-23). */
function Tile({ item, busy }: { item: ChatStartItem; busy: boolean }) {
    return (
        <Button
            type="button"
            variant="ghost"
            onClick={item.onSelect}
            disabled={busy}
            aria-label={item.ariaLabel}
            className={cn(ITEM, 'flex-row items-center gap-3 px-3.5 py-3')}
        >
            <span className="flex size-5 shrink-0 items-center justify-center [&_svg]:size-5">{item.icon}</span>
            <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">{item.title}</span>
                {item.description ? (
                    <span className="mt-0.5 truncate text-xs text-neutral-500 dark:text-neutral-400">{item.description}</span>
                ) : null}
            </span>
        </Button>
    );
}

function Row({ item, busy }: { item: ChatStartItem; busy: boolean }) {
    return (
        <Button
            type="button"
            variant="ghost"
            onClick={item.onSelect}
            disabled={busy}
            aria-label={item.ariaLabel}
            className={cn(ITEM, 'items-center gap-3 px-3.5 py-2.5')}
        >
            <span className="flex size-4 shrink-0 items-center justify-center text-neutral-500 dark:text-neutral-400 [&_svg]:size-4">{item.icon}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">{item.title}</span>
        </Button>
    );
}
