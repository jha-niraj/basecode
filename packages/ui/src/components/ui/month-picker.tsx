"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";

import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "../../lib/utils";

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function monthKey(year: number, index: number): string {
	return `${year}-${String(index + 1).padStart(2, "0")}`;
}

/** "2026-11" -> "November 2026". */
export function monthLabel(month: string): string {
	const y = Number(month.slice(0, 4));
	const m = Number(month.slice(5, 7)) - 1;
	return LONG[m] ? `${LONG[m]} ${y}` : month;
}

export type MonthPickerProps = {
	/** `YYYY-MM`. */
	value: string;
	onChange: (month: string) => void;
	/** Earliest pickable month, `YYYY-MM`. */
	min?: string;
	/** Latest pickable month, `YYYY-MM`. */
	max?: string;
	/** Marks this month with "so far" (the month in progress). */
	current?: string;
	id?: string;
	disabled?: boolean;
	className?: string;
	"aria-label"?: string;
};

/**
 * A month in one panel: the year with previous/next, and its twelve months as a 3x4 grid. Replaces
 * `<input type="month">`, which Safari desktop renders as a plain text box. Months outside min/max are
 * shown but disabled, so a year reads as a year.
 *
 * Keyboard: arrow keys move a month (left/right) or a row (up/down); PageUp/PageDown change the year.
 */
export function MonthPicker({ value, onChange, min, max, current, id, disabled, className, "aria-label": ariaLabel }: MonthPickerProps) {
	const [open, setOpen] = React.useState(false);
	const [year, setYear] = React.useState(() => Number(value.slice(0, 4)));
	const cells = React.useRef(new Map<string, HTMLButtonElement>());
	const firstYear = min ? Number(min.slice(0, 4)) : -Infinity;
	const lastYear = max ? Number(max.slice(0, 4)) : Infinity;

	const pickable = (month: string) => (!min || month >= min) && (!max || month <= max);

	function openChange(next: boolean) {
		if (next) setYear(Number(value.slice(0, 4)));
		setOpen(next);
	}

	function moveYear(delta: number) {
		setYear((y) => Math.min(lastYear, Math.max(firstYear, y + delta)));
	}

	function onGridKey(event: React.KeyboardEvent, index: number) {
		if (event.key === "PageUp" || event.key === "PageDown") {
			event.preventDefault();
			moveYear(event.key === "PageUp" ? -1 : 1);
			return;
		}
		const step =
			event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -3 : event.key === "ArrowDown" ? 3 : 0;
		if (!step) return;
		event.preventDefault();
		const target = index + step;
		if (target < 0 || target > 11) return;
		cells.current.get(monthKey(year, target))?.focus();
	}

	return (
		<Popover open={open} onOpenChange={openChange}>
			<PopoverTrigger asChild>
				<Button
					id={id}
					type="button"
					variant="outline"
					disabled={disabled}
					aria-label={ariaLabel ? `${ariaLabel}: ${monthLabel(value)}` : undefined}
					className={cn("w-full justify-between font-normal", className)}
				>
					<span className="flex min-w-0 items-center gap-2">
						<CalendarDays className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
						<span className="truncate">
							{monthLabel(value)}
							{current && value === current ? " (so far)" : ""}
						</span>
					</span>
					<ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="w-72 p-3"
				onOpenAutoFocus={(event) => {
					const cell = cells.current.get(value);
					if (cell && !cell.disabled) {
						event.preventDefault();
						cell.focus();
					}
				}}
			>
				<div className="mb-2 flex items-center justify-between">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						aria-label="Previous year"
						disabled={year <= firstYear}
						onClick={() => moveYear(-1)}
					>
						<ChevronLeft className="h-4 w-4" />
					</Button>
					<span className="text-sm font-semibold tabular-nums" aria-live="polite">
						{year}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						aria-label="Next year"
						disabled={year >= lastYear}
						onClick={() => moveYear(1)}
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
				<div className="grid grid-cols-3 gap-1.5" role="grid" aria-label={`Months of ${year}`}>
					{SHORT.map((short, index) => {
						const month = monthKey(year, index);
						const can = pickable(month);
						const on = month === value;
						const isCurrent = month === current && can;
						return (
							<button
								key={index}
								ref={(node) => {
									if (node) cells.current.set(month, node);
									else cells.current.delete(month);
								}}
								type="button"
								role="gridcell"
								aria-selected={on}
								aria-label={`${monthLabel(month)}${isCurrent ? ", so far" : ""}`}
								disabled={!can}
								onKeyDown={(event) => onGridKey(event, index)}
								onClick={() => {
									onChange(month);
									setOpen(false);
								}}
								className={cn(
									"flex h-12 cursor-pointer flex-col items-center justify-center rounded-lg border text-sm transition-colors",
									"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
									on ? "border-foreground bg-foreground font-medium text-background" : "border-transparent hover:bg-muted",
									isCurrent && !on && "border-border",
									!can && "cursor-not-allowed text-muted-foreground/50 hover:bg-transparent"
								)}
							>
								<span>{short}</span>
								{isCurrent && (
									<span className={cn("text-[0.625rem] leading-none", on ? "text-background/80" : "text-muted-foreground")}>so far</span>
								)}
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}
