"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "../../lib/utils"
import { POPPER_MOTION, POPPER_ORIGIN } from "../../lib/motion"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
		inset?: boolean
	}
>(({ className, inset, children, ...props }, ref) => (
	<DropdownMenuPrimitive.SubTrigger
		ref={ref}
		className={cn(
			"flex min-h-9 cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-neutral-700 outline-none focus:bg-neutral-950/[0.05] data-[state=open]:bg-neutral-950/[0.05] dark:text-neutral-200 dark:focus:bg-white/[0.07] dark:data-[state=open]:bg-white/[0.07] [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:text-neutral-500 dark:[&_svg]:text-neutral-400",
			inset && "pl-8",
			className
		)}
		{...props}
	>
		{children}
		<ChevronRight className="ml-auto h-4 w-4" />
	</DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
	DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.SubContent
		ref={ref}
		className={cn(
			"z-[80] min-w-[8rem] overflow-hidden rounded-2xl bg-neutral-50 p-1.5 text-popover-foreground ring-[0.5px] ring-neutral-950/10 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] dark:bg-neutral-900 dark:ring-white/10",
			POPPER_MOTION,
			POPPER_ORIGIN.dropdownMenu,
			className
		)}
		{...props}
	/>
))
DropdownMenuSubContent.displayName =
	DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
	<DropdownMenuPrimitive.Portal>
		<DropdownMenuPrimitive.Content
			ref={ref}
			sideOffset={sideOffset}
			className={cn(
				`
        z-[80] min-w-[10rem]
        rounded-2xl
        bg-neutral-50 dark:bg-neutral-900
        ring-[0.5px] ring-neutral-950/10 dark:ring-white/10
        p-1.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]
        `,
				// This had no motion while its own SubContent did - the nested submenu animated
				// and the menu that opened it did not.
				POPPER_MOTION,
				POPPER_ORIGIN.dropdownMenu,
				className
			)}
			{...props}
		/>
	</DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Item>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
		inset?: boolean
		/** `destructive` paints the item rose (delete, remove) - the shadcn/ReUI prop, so ported components keep working. */
		variant?: "default" | "destructive"
	}
>(({ className, inset, variant = "default", ...props }, ref) => (
	<DropdownMenuPrimitive.Item
		ref={ref}
		data-variant={variant}
		className={cn(
			`
				relative flex min-h-9 cursor-pointer select-none items-center gap-3 outline-none
				rounded-xl px-3 py-2 text-sm font-medium
				[&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:text-neutral-500 dark:[&_svg]:text-neutral-400

				text-neutral-700 dark:text-neutral-200
				transition-colors

				focus:bg-neutral-950/[0.05] dark:focus:bg-white/[0.07]
				data-[disabled]:pointer-events-none
				data-[disabled]:opacity-50
      		`,
			inset && "pl-8",
			variant === "destructive" && "text-rose-600 focus:bg-rose-50 dark:text-rose-400 dark:focus:bg-rose-950/40 [&_svg]:!text-rose-600 dark:[&_svg]:!text-rose-400",
			className
		)}
		{...props}
	/>
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
	<DropdownMenuPrimitive.CheckboxItem
		ref={ref}
		checked={checked}
		className={cn(
			`
				relative flex min-h-9 cursor-pointer select-none items-center gap-3 outline-none [&_svg]:size-4 [&_svg]:shrink-0
				rounded-xl py-2 pl-8 pr-3 text-sm font-medium

				text-neutral-700 dark:text-neutral-200
				focus:bg-neutral-950/[0.05] dark:focus:bg-white/[0.07]
      		`,
			className
		)}
		{...props}
	>
		<span className="absolute left-2 flex h-4 w-4 items-center justify-center">
			<DropdownMenuPrimitive.ItemIndicator>
				<Check className="h-4 w-4" />
			</DropdownMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.CheckboxItem>
))

DropdownMenuCheckboxItem.displayName =
	DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
	<DropdownMenuPrimitive.RadioItem
		ref={ref}
		className={cn(
			`
				relative flex min-h-9 cursor-pointer select-none items-center gap-3 outline-none [&_svg]:size-4 [&_svg]:shrink-0
				rounded-xl py-2 pl-8 pr-3 text-sm font-medium

				text-neutral-700 dark:text-neutral-200
				transition-colors

				focus:bg-neutral-950/[0.05] dark:focus:bg-white/[0.07]
				data-[state=checked]:bg-neutral-200
				dark:data-[state=checked]:bg-neutral-700

				data-[disabled]:pointer-events-none
				data-[disabled]:opacity-50
      		`,
			className
		)}
		{...props}
	>
		<span className="absolute left-2 flex h-4 w-4 items-center justify-center">
			<DropdownMenuPrimitive.ItemIndicator>
				<Circle className="h-2.5 w-2.5 fill-current text-neutral-900 dark:text-white" />
			</DropdownMenuPrimitive.ItemIndicator>
		</span>
		{children}
	</DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName =
	DropdownMenuPrimitive.RadioItem.displayName


const DropdownMenuLabel = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Label>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
		inset?: boolean
	}
>(({ className, inset, ...props }, ref) => (
	<DropdownMenuPrimitive.Label
		ref={ref}
		className={cn(
			"px-2 py-1.5 text-sm font-semibold",
			inset && "pl-8",
			className
		)}
		{...props}
	/>
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
	React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
	React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
	<DropdownMenuPrimitive.Separator
		ref={ref}
		className={cn(
			"my-1 h-px bg-neutral-200 dark:bg-neutral-700",
			className
		)}
		{...props}
	/>
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
	className,
	...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
	return (
		<span
			className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
			{...props}
		/>
	)
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuCheckboxItem,
	DropdownMenuRadioItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuGroup,
	DropdownMenuPortal,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuRadioGroup,
}
