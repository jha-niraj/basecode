"use client"

import * as React from "react"

import { cn } from "../../lib/utils"

/**
 * The shared table.
 *
 * `scroller="parent"`: render the bare `<table>`, with no `overflow-auto` wrapper, for a table that already sits in a
 * `ScrollArea` (the house rule). The wrapper is its own scroll container, so a `sticky` header inside it sticks to a
 * box that never scrolls and rides away with the rows - a list header did exactly that (the owner, 2026-10-18).
 * Pair it with `<TableHeader sticky>`.
 *
 * Pinned columns - `pin="end"` on `TableHead` AND `TableCell` of the row-action column (Open, Edit, a "..." menu)
 * (the owner, 2026-10-26: on a phone the action buttons must stay on screen while the other columns scroll, so people act
 * without scrolling to the end). Only the END is pinned: a pinned first column too covered most of a 360px screen and
 * hid the columns people scrolled to see (the owner, same day) - so there is no `pin="start"`.
 * - A pinned cell sticks to the NEAREST scroll container. Inside a `ScrollArea` that is the viewport, so the table must
 *   be `scroller="parent"` - its own `overflow-auto` wrapper would be a scroller that never scrolls and the cells would
 *   not stick. With no ScrollArea round it, the default `scroller="own"` wrapper scrolls and pins work there too.
 * - Its background is solid and still follows the row: it inherits the row's colour (hover, selected, a tinted row)
 *   and blends it over white / neutral-900 (`bg-blend-darken` / `lighten`), so a translucent row tint looks the same
 *   on the pinned cell while scrolled cells never show through. On a non-white card, pass the card colour as a
 *   `bg-[image:linear-gradient(<c>,<c>)]` class on the pinned cells.
 * - Edge shadow only when something is hidden under it: `Table` finds its scroll container and sets
 *   `data-scroll-start` (content hidden to the left) / `data-scroll-end` (hidden to the right) on it from a scroll
 *   listener + ResizeObserver. A pinned cell shows a shadow on its left with `data-scroll-end`. At full width nothing scrolls, no attribute is set, and the table looks as before.
 * - Works with `<TableHeader sticky>`: a pinned header cell is the corner, sticky both ways and above everything.
 */
const Table = React.forwardRef<
	HTMLTableElement,
	React.HTMLAttributes<HTMLTableElement> & { scroller?: "own" | "parent" }
>(({ className, scroller = "own", ...props }, ref) => {
	const innerRef = React.useRef<HTMLTableElement | null>(null)
	const setRef = React.useCallback(
		(node: HTMLTableElement | null) => {
			innerRef.current = node
			if (typeof ref === "function") ref(node)
			else if (ref) ref.current = node
		},
		[ref],
	)
	useScrollEdges(innerRef)
	const table = <table ref={setRef} className={cn("w-full caption-bottom text-sm", className)} {...props} />
	if (scroller === "parent") return table
	return <div className="relative w-full overflow-auto">{table}</div>
})
Table.displayName = "Table"

/** Finds the table's nearest horizontal scroll container (its own wrapper, or the ScrollArea viewport with
 * `scroller="parent"`) and marks it `data-scroll-start` / `data-scroll-end` while content is hidden to that side.
 * Pinned cells read the attributes for their edge shadow. Exported for a hand-built scroller that wants the same. */
function useScrollEdges(tableRef: React.RefObject<HTMLElement | null>) {
	React.useEffect(() => {
		const table = tableRef.current
		if (!table || typeof window === "undefined") return
		let scroller: HTMLElement | null = table.parentElement
		while (scroller && scroller !== document.body) {
			const overflowX = window.getComputedStyle(scroller).overflowX
			if (overflowX === "auto" || overflowX === "scroll") break
			scroller = scroller.parentElement
		}
		if (!scroller || scroller === document.body) return
		const el = scroller
		const update = () => {
			const max = el.scrollWidth - el.clientWidth
			const x = el.scrollLeft
			el.toggleAttribute("data-scroll-start", max > 1 && x > 1)
			el.toggleAttribute("data-scroll-end", max > 1 && x < max - 1)
		}
		update()
		el.addEventListener("scroll", update, { passive: true })
		const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
		observer?.observe(el)
		observer?.observe(table)
		return () => {
			el.removeEventListener("scroll", update)
			observer?.disconnect()
			el.removeAttribute("data-scroll-start")
			el.removeAttribute("data-scroll-end")
		}
	}, [tableRef])
}

type Pin = "end"

/** Classes for a pinned cell. `z-[1]` keeps it over the scrolled cells; a header cell is `z-[2]` (inside a sticky
 * thead, which is `z-10`, so the corner sits above both). Background: the row's own colour (`bg-inherit`) blended
 * over an opaque white / neutral-900 layer - darken in light, lighten in dark - so it is solid AND tracks hover. */
function pinClasses(pin: Pin | undefined, head: boolean) {
	if (!pin) return undefined
	return cn(
		"sticky bg-inherit bg-[image:linear-gradient(#fff,#fff)] bg-blend-darken dark:bg-[image:linear-gradient(#171717,#171717)] dark:bg-blend-lighten",
		// A pinned header cell's solid fill would hide the sticky thead's inset bottom line - draw it on the cell too.
		head
			? "z-[2] [thead[data-sticky]_&]:shadow-[inset_0_-1px_0_var(--color-border,#e5e5e5)] dark:[thead[data-sticky]_&]:shadow-[inset_0_-1px_0_#262626]"
			: "z-[1]",
		"after:pointer-events-none after:absolute after:inset-y-0 after:w-2 after:opacity-0 after:transition-opacity after:content-['']",
		"right-0 after:-left-2 after:bg-[linear-gradient(to_left,rgb(0_0_0/0.08),transparent)] dark:after:bg-[linear-gradient(to_left,rgb(0_0_0/0.5),transparent)] [[data-scroll-end]_&]:after:opacity-100",
	)
}

const TableHeader = React.forwardRef<
	HTMLTableSectionElement,
	React.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }
>(({ className, sticky = false, ...props }, ref) => (
	<thead
		ref={ref}
		data-sticky={sticky ? "" : undefined}
		className={cn(
			"[&_tr]:border-b",
			sticky && "sticky top-0 z-10 bg-white shadow-[inset_0_-1px_0_var(--color-border,#e5e5e5)] dark:bg-neutral-900 dark:shadow-[inset_0_-1px_0_#262626]",
			className,
		)}
		{...props}
	/>
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
	HTMLTableSectionElement,
	React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
	<tbody
		ref={ref}
		className={cn("[&_tr:last-child]:border-0", className)}
		{...props}
	/>
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
	HTMLTableSectionElement,
	React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
	<tfoot
		ref={ref}
		className={cn(
			"border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
			className
		)}
		{...props}
	/>
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
	HTMLTableRowElement,
	React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
	<tr
		ref={ref}
		className={cn(
			"border-b",
			className
		)}
		{...props}
	/>
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
	HTMLTableCellElement,
	React.ThHTMLAttributes<HTMLTableCellElement> & { pin?: Pin }
>(({ className, pin, ...props }, ref) => (
	<th
		ref={ref}
		data-pin={pin}
		className={cn(
			// Compact by default. This was `h-12 px-4` with `p-4` cells, which made a two-line row
			// about 78px tall - a 35-row roster showed FIVE rows on a 1080px monitor and spent the
			// rest of the screen on padding. Changed here rather than overridden on each of the 27
			// pages that render a table, so density is one decision instead of 27 that drift.
			// A cell whose content is taller than this (a button, an input) still sizes to it.
			"h-9 px-3 text-left align-middle text-xs font-bold text-muted-foreground [&:has([role=checkbox])]:pr-0",
			pinClasses(pin, true),
			className
		)}
		{...props}
	/>
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
	HTMLTableCellElement,
	React.TdHTMLAttributes<HTMLTableCellElement> & { pin?: Pin }
>(({ className, pin, ...props }, ref) => (
	<td
		ref={ref}
		data-pin={pin}
		className={cn("px-3 py-1.5 align-middle [&:has([role=checkbox])]:pr-0", pinClasses(pin, false), className)}
		{...props}
	/>
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
	HTMLTableCaptionElement,
	React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
	<caption
		ref={ref}
		className={cn("mt-4 text-sm text-muted-foreground", className)}
		{...props}
	/>
))
TableCaption.displayName = "TableCaption"

export {
	Table,
	TableHeader,
	TableBody,
	TableFooter,
	TableHead,
	TableRow,
	TableCell,
	TableCaption,
	useScrollEdges,
}
