"use client"

import * as React from "react"
import { Search, SearchX } from "lucide-react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "../../lib/utils"
import { scoreCandidate } from "../../lib/fuzzy-search"
import { Dialog, DialogContent, DialogTitle } from "@repo/ui/components/ui/dialog"
import {
	Command,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
} from "@repo/ui/components/ui/command"

export interface CommandPaletteItem {
	id: string
	label: string
	description?: string
	icon?: React.ComponentType<{ className?: string }>
	keywords?: string[]
	shortcut?: string
	onSelect: () => void
}

export interface CommandPaletteGroup {
	heading?: string
	items: CommandPaletteItem[]
}

interface CommandPaletteProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	groups: CommandPaletteGroup[]
	placeholder?: string
	emptyMessage?: string
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
	<kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-xs font-medium text-muted-foreground">
		{children}
	</kbd>
)

interface ScoredItem extends CommandPaletteItem { section: string }

function scoreItem(item: ScoredItem, q: string): number {
	return scoreCandidate(item.label, [item.section, ...(item.keywords ?? [])], q)
}

/**
 * A cmdk-powered command palette anchored near the TOP of the viewport rather
 * than vertically centred. Centring caps the result list at roughly half the
 * screen because the panel grows in both directions from the middle; anchoring
 * it high lets the list run down toward the bottom of the window, so many more
 * options are visible without scrolling.
 *
 * When there's a query we do our OWN scoring and render ONE flat list globally
 * sorted by score (shouldFilter=false) so the best name match is always first -
 * grouping only in the empty-query browse view. Up/Down + Enter + Esc keyboard
 * model comes from cmdk.
 */
export function CommandPalette({
	open,
	onOpenChange,
	groups,
	placeholder = "Search pages, and features...",
	emptyMessage = "No results found.",
}: CommandPaletteProps) {
	const [query, setQuery] = React.useState("")
	const trimmed = query.trim()
	const inputRef = React.useRef<HTMLInputElement>(null)

	// Fresh query every time the palette opens - unless `openCommandPalette(query)` handed one over.
	React.useEffect(() => {
		if (!open) { setQuery(""); return }
		if (pendingQuery) { setQuery(pendingQuery); pendingQuery = "" }
	}, [open])

	// Radix's own open-autofocus is suppressed below (it would land on the Esc
	// button, the first focusable in the panel), so put the caret in the search
	// field explicitly - a search palette you have to click into is broken.
	React.useEffect(() => {
		if (!open) return
		const id = requestAnimationFrame(() => inputRef.current?.focus())
		return () => cancelAnimationFrame(id)
	}, [open])

	const flatItems = React.useMemo<ScoredItem[]>(
		() => groups.flatMap((g) => g.items.map((it) => ({ ...it, section: g.heading ?? "" }))),
		[groups],
	)

	const results = React.useMemo<ScoredItem[] | null>(() => {
		if (!trimmed) return null
		return flatItems
			.map((it) => ({ it, s: scoreItem(it, trimmed) }))
			.filter((x) => x.s > 0)
			.sort((a, b) => b.s - a.s)
			.map((x) => x.it)
	}, [flatItems, trimmed])

	const renderItem = (item: CommandPaletteItem) => (
		<CommandItem
			key={item.id}
			value={item.id}
			onSelect={() => { onOpenChange(false); item.onSelect() }}
			className="cursor-pointer gap-2.5 rounded-lg px-3 py-2.5 data-[selected=true]:bg-accent"
		>
			{item.icon && <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
			<span className="flex-1 truncate">
				{item.label}
				{item.description && <span className="ml-2 text-xs text-muted-foreground">{item.description}</span>}
			</span>
			{item.shortcut && <span className="ml-auto text-xs tracking-widest text-muted-foreground">{item.shortcut}</span>}
		</CommandItem>
	)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					// Top-anchored, not centred. `top-*` and `translate-y-0` override the
					// shared DialogContent's top-1/2 + -translate-y-1/2 via tailwind-merge;
					// horizontal centring is left untouched.
					"top-4 translate-y-0 sm:top-16",
					// z-[220] so the palette sits ABOVE the Orbital AI panel (z-[55]) and its
					// mobile sheet (z-[200]) - the search box must never be covered.
					// `sm:rounded-2xl` as well as the base: the shared DialogContent sets
					// sm:rounded-lg, and a different variant is not a tailwind-merge
					// conflict, so an unprefixed radius alone would lose above 640px.
					"z-[220] w-[95vw] max-w-[640px] gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl sm:rounded-2xl [&>button]:hidden",
					// A panel pinned to the top should arrive from the top. This layers on
					// top of the shared zoom rather than replacing it (zoom-in-* is not a
					// tailwind-merge group, so an override would not reliably win).
					"data-[state=closed]:slide-out-to-top-4 data-[state=open]:slide-in-from-top-4",
				)}
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<DialogTitle className="sr-only">Search</DialogTitle>
				<Command
					shouldFilter={false}
					className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
					loop
				>
					{/* The field is its own bordered box inside the panel, so the search
					    target reads as a distinct control rather than a panel edge. */}
					<div className="p-2">
						<div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 transition-colors focus-within:border-foreground/30 focus-within:bg-background">
							<Search className="h-4 w-4 shrink-0 text-muted-foreground" />
							<CommandPrimitive.Input
								ref={inputRef}
								value={query}
								onValueChange={setQuery}
								placeholder={placeholder}
								className="flex h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
							/>
							<button
								type="button"
								onClick={() => onOpenChange(false)}
								className="shrink-0 cursor-pointer rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
							>
								Esc
							</button>
						</div>
					</div>
					{/* Sized against the viewport rather than a fixed 420px: the panel top
					    (4rem) plus the field and footer come to roughly 13rem of chrome, so
					    the list takes everything else down to the bottom of the window. */}
					<CommandList className="max-h-[calc(100dvh-11rem)] overflow-y-auto overflow-x-hidden px-2 pb-2 sm:max-h-[calc(100dvh-13rem)] [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
						{results
							? (results.length === 0
								? (
									<CommandEmpty className="px-4 py-12 text-center">
										<div className="flex flex-col items-center gap-3">
											<span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground">
												<SearchX className="h-5 w-5" />
											</span>
											<div>
												<p className="text-sm font-medium text-foreground">{emptyMessage}</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Try a different word, or a page name like &ldquo;settings&rdquo;.
												</p>
											</div>
										</div>
									</CommandEmpty>
								)
								: <CommandGroup heading="Results">{results.map(renderItem)}</CommandGroup>)
							: groups.map((group, gi) => (
								<CommandGroup key={group.heading ?? gi} heading={group.heading}>
									{group.items.map(renderItem)}
								</CommandGroup>
							))}
					</CommandList>
					<div className="flex items-center gap-4 border-t px-3 py-2 text-xs text-muted-foreground">
						<span className="flex items-center gap-1.5"><Kbd>&uarr;</Kbd><Kbd>&darr;</Kbd>to navigate</span>
						<span className="flex items-center gap-1.5"><Kbd>&crarr;</Kbd>to select</span>
						<span className="ml-auto flex items-center gap-1.5"><Kbd>esc</Kbd>to close</span>
					</div>
				</Command>
			</DialogContent>
		</Dialog>
	)
}

/**
 * The sidebar entry point: a button styled like a search input. Clicking it
 * opens the command palette. Shows a mac/win-aware shortcut hint when expanded,
 * or just the icon when the sidebar is collapsed.
 */
export function SidebarSearchButton({
	onClick,
	collapsed = false,
	placeholder = "Quick search...",
	className,
}: {
	onClick: () => void
	collapsed?: boolean
	placeholder?: string
	className?: string
}) {
	const [isMac, setIsMac] = React.useState(true)
	React.useEffect(() => {
		setIsMac(/Mac|iPhone|iPad/.test(navigator.platform) || /Mac/.test(navigator.userAgent))
	}, [])

	if (collapsed) {
		return (
			<button
				type="button"
				onClick={onClick}
				title="Search"
				aria-label="Open search"
				className={cn(
					"flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground transition-colors hover:text-foreground",
					className,
				)}
			>
				<Search className="h-4 w-4" />
			</button>
		)
	}

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Open search"
			className={cn(
				// `overflow-hidden` + `min-w-0` matter during the sidebar's 300ms width
				// animation: the label and shortcut would otherwise wrap onto a second line
				// as the container narrows, which is the jump seen while collapsing.
				// Clipped instead, so the button keeps its height throughout.
				"group flex w-full min-w-0 cursor-pointer items-center gap-2 overflow-hidden rounded-lg border border-border bg-muted/60 px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
				className,
			)}
		>
			<Search className="h-3.5 w-3.5 shrink-0" />
			<span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">{placeholder}</span>
			<kbd className="pointer-events-none hidden shrink-0 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-sans text-xs font-medium text-muted-foreground sm:inline-flex">
				{isMac ? "⌘" : "Ctrl"}K
			</kbd>
		</button>
	)
}

/** Fired by `openCommandPalette`; whichever shell has a palette mounted opens it. */
export const OPEN_COMMAND_PALETTE_EVENT = "app:open-command-palette"

/** A query handed over by `openCommandPalette`, read once when the palette opens. */
let pendingQuery = ""

/**
 * Opens the app's command palette from anywhere (a 404's search box, an empty state), with
 * an optional query already typed in. Returns false when no palette is mounted - a page
 * rendered outside the app shell - so the caller can fall back to navigating somewhere.
 */
export function openCommandPalette(query = ""): boolean {
	if (typeof document === "undefined") return false
	pendingQuery = query
	const event = new Event(OPEN_COMMAND_PALETTE_EVENT, { cancelable: true })
	const handled = !document.dispatchEvent(event)
	if (!handled) pendingQuery = ""
	return handled
}

/**
 * Registers a global Cmd/Ctrl+K listener that toggles the palette open, and answers
 * `openCommandPalette()` calls.
 */
export function useCommandPaletteShortcut(setOpen: (updater: (v: boolean) => boolean) => void) {
	React.useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
				e.preventDefault()
				setOpen((v) => !v)
			}
		}
		const openFromEvent = (e: Event) => {
			e.preventDefault()
			setOpen(() => true)
		}
		document.addEventListener("keydown", down)
		document.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openFromEvent)
		return () => {
			document.removeEventListener("keydown", down)
			document.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openFromEvent)
		}
	}, [setOpen])
}
