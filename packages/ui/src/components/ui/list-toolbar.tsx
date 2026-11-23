'use client';

import { useState } from 'react';
import { Check, ListFilter, Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { ChipFilters, type ChipFilterField, type ChipFilterValues } from './chip-filters';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from './input-group';
import { ScrollArea } from './scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from './sheet';

/**
 * The one list toolbar (owner, 2026-11-22: "Fold into one row, and on small screens everything goes to the sheet
 * except the search and one button to open the sheet from the bottom").
 *
 * - From `sm`: search, the `ChipFilters` row, the sort select and the chip row's Clear, as every list had it.
 * - Below `sm`: ONE row of search plus a 44px Filters button with a count. The button opens a bottom sheet with each
 *   field (and the sort) as a group of 44px options; picks apply live, the footer shows the result count and closes.
 *   Active picks also sit under the row as removable chips in their own horizontal scroller, so the page never moves
 *   sideways and you can see what is filtering without opening the sheet.
 *
 * The caller keeps its own state (search string, `ChipFilterValues`, sort key); nothing here changes its filtering.
 */

export interface ListToolbarSortOption {
    value: string;
    label: string;
}

export interface ListToolbarSort {
    options: ReadonlyArray<ListToolbarSortOption>;
    value: string;
    onChange: (next: string) => void;
    /** The order the list starts in; a different one counts as an active pick. Defaults to the first option. */
    defaultValue?: string;
    /** Accessible name of the desktop select, e.g. "Sort refunds". */
    label?: string;
}

export interface ListToolbarProps {
    search: string;
    onSearchChange: (next: string) => void;
    searchPlaceholder: string;
    /** Accessible name of the search box, e.g. "Search refunds". */
    searchLabel?: string;
    fields: ReadonlyArray<ChipFilterField>;
    values: ChipFilterValues;
    onValuesChange: (next: ChipFilterValues) => void;
    sort?: ListToolbarSort;
    /** Rows matching search + filters right now: the phone sheet's "Show N results". */
    resultCount: number;
    /** Singular / plural noun for the result button ("refund" / "refunds"). Defaults to "result" / "results". */
    noun?: [singular: string, plural: string];
    className?: string;
}

const OPTION =
    'inline-flex h-11 min-w-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';
const OPTION_OFF =
    'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800';
const OPTION_ON =
    'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900';

function OptionGroup({
    label,
    hint,
    options,
    value,
    onPick,
    anyLabel,
    disabled,
}: {
    label: string;
    hint?: string;
    options: ReadonlyArray<{ value: string; label: string }>;
    value: string | undefined;
    onPick: (next: string | undefined) => void;
    /** When set, an option that clears the group ("Any"). A sort has no "Any", so it passes nothing. */
    anyLabel?: string;
    disabled?: boolean;
}) {
    const all = anyLabel ? [{ value: '', label: anyLabel }, ...options] : options;
    return (
        <fieldset className="flex min-w-0 flex-col gap-2" disabled={disabled}>
            <legend className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">{label}</legend>
            {hint ? <p className="-mt-1 text-xs text-neutral-500 dark:text-neutral-400">{hint}</p> : null}
            <div role="radiogroup" aria-label={label} className="flex min-w-0 flex-wrap gap-2">
                {all.map((o) => {
                    const on = (value ?? '') === o.value;
                    return (
                        <button
                            key={o.value || '__any'}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => onPick(o.value || undefined)}
                            className={cn(OPTION, on ? OPTION_ON : OPTION_OFF)}
                        >
                            {on ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                            <span className="truncate">{o.label}</span>
                        </button>
                    );
                })}
            </div>
        </fieldset>
    );
}

export function ListToolbar({
    search,
    onSearchChange,
    searchPlaceholder,
    searchLabel,
    fields,
    values,
    onValuesChange,
    sort,
    resultCount,
    noun = ['result', 'results'],
    className,
}: ListToolbarProps) {
    const [open, setOpen] = useState(false);
    const sortDefault = sort ? (sort.defaultValue ?? sort.options[0]?.value ?? '') : '';
    const sortActive = Boolean(sort && sort.value !== sortDefault);
    const picked = fields.filter((f) => values[f.key]);
    const activeCount = picked.length + (sortActive ? 1 : 0);

    const setField = (key: string, value: string | undefined) => {
        const next: ChipFilterValues = { ...values };
        if (value) next[key] = value;
        else delete next[key];
        onValuesChange(next);
    };
    const clearSheet = () => {
        onValuesChange({});
        if (sort && sortActive) sort.onChange(sortDefault);
    };

    const sortLabel = sort?.options.find((o) => o.value === sort.value)?.label;

    return (
        <div className={cn('flex min-w-0 flex-col gap-2', className)}>
            <div className="flex min-w-0 items-center gap-2">
                <InputGroup className="h-11 min-w-0 flex-1 sm:h-9 sm:max-w-xs">
                    <InputGroupAddon><Search className="h-4 w-4" /></InputGroupAddon>
                    <InputGroupInput
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') onSearchChange(''); }}
                        placeholder={searchPlaceholder}
                        aria-label={searchLabel ?? searchPlaceholder}
                    />
                    {search ? (
                        <InputGroupAddon align="inline-end">
                            <InputGroupButton size="icon-xs" aria-label="Clear search" onClick={() => onSearchChange('')} className="relative after:absolute after:-inset-2.5 after:content-['']">
                                <X className="h-3.5 w-3.5" />
                            </InputGroupButton>
                        </InputGroupAddon>
                    ) : null}
                </InputGroup>

                <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
                    <ChipFilters fields={fields} values={values} onChange={onValuesChange} className="min-w-0 flex-1" showClear />
                    {sort ? (
                        <Select value={sort.value} onValueChange={sort.onChange}>
                            <SelectTrigger size="sm" className="h-9 w-auto shrink-0 gap-1.5" aria-label={sort.label ?? 'Sort'}>
                                <ListFilter className="h-3.5 w-3.5 text-neutral-500" />
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                                {sort.options.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    ) : null}
                </div>

                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(true)}
                    aria-haspopup="dialog"
                    aria-label={activeCount ? `Filters, ${activeCount} active` : 'Filters'}
                    className="h-11 shrink-0 gap-2 px-3.5 sm:hidden"
                >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span>Filters</span>
                    {activeCount ? (
                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-neutral-900 px-1.5 text-xs font-semibold tabular-nums text-white dark:bg-white dark:text-neutral-900">
                            {activeCount}
                        </span>
                    ) : null}
                </Button>
            </div>

            {activeCount ? (
                <ScrollArea orientation="horizontal" className="w-full min-w-0 sm:hidden">
                    <div className="flex w-max items-center gap-2 py-1">
                        {picked.map((f) => {
                            const label = f.options.find((o) => o.value === values[f.key])?.label ?? values[f.key];
                            return (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setField(f.key, undefined)}
                                    aria-label={`Remove ${f.label}: ${label}`}
                                    className="relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white pl-3 pr-2 text-xs text-neutral-700 after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                                >
                                    <span className="text-neutral-500 dark:text-neutral-400">{f.label}</span>
                                    <span className="font-medium">{label}</span>
                                    <X className="h-3.5 w-3.5 text-neutral-400" />
                                </button>
                            );
                        })}
                        {sort && sortActive ? (
                            <button
                                type="button"
                                onClick={() => sort.onChange(sortDefault)}
                                aria-label={`Reset sort: ${sortLabel}`}
                                className="relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white pl-3 pr-2 text-xs text-neutral-700 after:absolute after:-inset-y-1 after:inset-x-0 after:content-[''] dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                            >
                                <span className="text-neutral-500 dark:text-neutral-400">Sort</span>
                                <span className="font-medium">{sortLabel}</span>
                                <X className="h-3.5 w-3.5 text-neutral-400" />
                            </button>
                        ) : null}
                    </div>
                </ScrollArea>
            ) : null}

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-t-2xl">
                    <SheetHeader>
                        <SheetTitle>Filters</SheetTitle>
                        <SheetDescription>Picks apply as you tap them.</SheetDescription>
                    </SheetHeader>
                    <div className="-mx-6 min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
                        <div className="flex flex-col gap-6">
                            {fields.map((f) => (
                                <OptionGroup
                                    key={f.key}
                                    label={f.label}
                                    hint={f.disabledReason}
                                    disabled={Boolean(f.disabledReason)}
                                    options={f.options}
                                    value={values[f.key]}
                                    onPick={(v) => setField(f.key, v)}
                                    anyLabel="Any"
                                />
                            ))}
                            {sort ? (
                                <OptionGroup
                                    label="Sort"
                                    options={sort.options}
                                    value={sort.value}
                                    onPick={(v) => sort.onChange(v ?? sortDefault)}
                                />
                            ) : null}
                        </div>
                    </div>
                    <SheetFooter className="-mx-6 -mb-6 mt-0 flex-row border-t border-neutral-200 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:border-neutral-800">
                        <Button type="button" variant="outline" className="h-11 flex-1" onClick={clearSheet} disabled={!activeCount}>
                            Clear all
                        </Button>
                        <Button type="button" className="h-11 flex-1" onClick={() => setOpen(false)}>
                            Show {resultCount.toLocaleString('en-IN')} {resultCount === 1 ? noun[0] : noun[1]}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
