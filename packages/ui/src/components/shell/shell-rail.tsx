"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Bell, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { usePathname } from "next/navigation"

import { AppLink } from "../app-link"
import { ThemeSwitch } from "../theme-switch"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { ScrollArea } from "../ui/scroll-area"
import { SigningOutScreen } from "../ui/signing-out-screen"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { useSignOut } from "../../hooks/use-sign-out"
import { activeHref, type ShellMenuLink, type ShellNavSection, type ShellUser } from "../../lib/shell"
import { cn } from "../../lib/utils"

/**
 * The rail's CONTENT - brand row, nav, footer (theme, bell, account). The same tree renders in the desktop rail and in
 * the phone "More" sheet, so the two can never disagree. The frame around it (fixed, pinned / peeking, shadow) is
 * `AppShell`'s job.
 */

export interface ShellBrand {
    name: string
    href: string
    /** A small mark left of the name (an svg, an img). Defaults to the name's first letter in a square tile. */
    mark?: React.ReactNode
}

export interface ShellNotifications {
    /** Unread count; a dot shows when above zero. */
    unread: number
    /** Opens the app's notifications panel. */
    onOpen: () => void
}

export interface ShellAccount {
    user: ShellUser
    profileHref: string
    /** The bare sign-in page sign-out lands on (`/signin`, admin `/`). */
    signInPath: string
    /** The app's QueryClient, emptied on sign-out so Back cannot redraw the last person's data. */
    queryClient?: { clear: () => void } | null
    /** Rows between Profile and Sign out. */
    links?: ShellMenuLink[]
}

export interface ShellRailProps {
    brand: ShellBrand
    nav: ShellNavSection[]
    account: ShellAccount
    notifications?: ShellNotifications
    /** Pinned state + setter for the pin button (desktop rail only; omitted in the phone sheet). */
    pin?: { isPinned: boolean; setPinned: (v: boolean) => void }
    /** Called after a nav link is pressed (the phone sheet closes itself). */
    onNavigate?: () => void
    /** Extra controls in the footer row, before the bell. */
    footerExtra?: React.ReactNode
}

function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")).toUpperCase()
}

const ICON_BTN =
    "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md p-0 text-neutral-600 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white"

export function ShellRail({ brand, nav, account, notifications, pin, onNavigate, footerExtra }: ShellRailProps) {
    const pathname = usePathname() ?? "/"
    const active = activeHref(pathname, nav)

    return (
        <div className="flex h-full min-h-0 w-full flex-col">
            {/* Brand row - the same 56px as nothing else, so the rail's top reads as one band. */}
            <div className="flex h-14 shrink-0 items-center gap-2 px-3">
                <AppLink
                    href={brand.href}
                    onClick={onNavigate}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                >
                    {brand.mark ?? (
                        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900">
                            {brand.name.slice(0, 1).toUpperCase()}
                        </span>
                    )}
                    <span className="truncate text-sm font-semibold text-neutral-900 dark:text-white">{brand.name}</span>
                </AppLink>
                {pin && (
                    <Tooltip delayDuration={400}>
                        <TooltipTrigger asChild>
                            <Button variant="ghost"
                                type="button"
                                onClick={() => pin.setPinned(!pin.isPinned)}
                                aria-label={pin.isPinned ? "Hide sidebar" : "Keep sidebar open"}
                                aria-pressed={pin.isPinned}
                                className={ICON_BTN}
                            >
                                {pin.isPinned ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                            {pin.isPinned ? "Hide sidebar - hover the left edge to bring it back" : "Keep sidebar open"} (Ctrl/Cmd + \)
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>

            <ScrollArea orientation="vertical" className="min-h-0 flex-1">
                <nav aria-label="Main" className="flex flex-col gap-4 px-3 pb-3 pt-1">
                    {nav.map((section) => (
                        <div key={section.id} className="flex flex-col gap-0.5">
                            {section.label && (
                                <p className="px-2.5 pb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">{section.label}</p>
                            )}
                            {section.items.map((item) => {
                                const on = active === item.href
                                const Icon = item.icon
                                return (
                                    <AppLink
                                        key={item.href}
                                        href={item.href}
                                        onClick={onNavigate}
                                        aria-current={on ? "page" : undefined}
                                        className={cn(
                                            "flex h-9 min-w-0 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400",
                                            on
                                                ? "bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white"
                                                : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-white",
                                        )}
                                    >
                                        <Icon className="h-4 w-4 shrink-0" />
                                        <span className="min-w-0 flex-1 truncate">{item.name}</span>
                                        {item.badge ? (
                                            <span className="shrink-0 rounded-full bg-neutral-200 px-1.5 text-xs font-medium tabular-nums text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200">
                                                {item.badge > 99 ? "99+" : item.badge}
                                            </span>
                                        ) : null}
                                    </AppLink>
                                )
                            })}
                        </div>
                    ))}
                </nav>
            </ScrollArea>

            <div className="flex shrink-0 flex-col gap-1 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
                <div className="flex items-center gap-1 px-1 pb-1">
                    <ThemeSwitch />
                    <div className="ml-auto flex items-center gap-1">
                        {footerExtra}
                        {notifications && (
                            <Button variant="ghost"
                                type="button"
                                onClick={notifications.onOpen}
                                aria-label={notifications.unread > 0 ? `Notifications, ${notifications.unread} unread` : "Notifications"}
                                className={cn(ICON_BTN, "relative")}
                            >
                                <Bell className="h-4 w-4" />
                                {notifications.unread > 0 && (
                                    <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#161718]" />
                                )}
                            </Button>
                        )}
                    </div>
                </div>
                <AccountRow account={account} onNavigate={onNavigate} />
            </div>
        </div>
    )
}

/** The account row: avatar, name, email; opens a menu with Profile, the app's extra links and Sign out. */
export function AccountRow({ account, onNavigate }: { account: ShellAccount; onNavigate?: () => void }) {
    const { user } = account
    const { signOut, pending, prefetchProps } = useSignOut({ signInPath: account.signInPath, queryClient: account.queryClient })
    const [mounted, setMounted] = React.useState(false)
    React.useEffect(() => setMounted(true), [])

    // No menu: the row IS the way to Profile, and sign-out is one press beside it (owner, 2026-11-23 - a menu holding
    // two items was a detour).
    return (
        <>
            <div className="flex min-w-0 items-center gap-1">
                <AppLink
                    href={account.profileHref}
                    onClick={onNavigate}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                >
                    <Avatar className="h-8 w-8 shrink-0">
                        {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                        <AvatarFallback className="text-xs font-medium">{initials(user.name)}</AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-neutral-900 dark:text-white">{user.name}</span>
                        <span className="truncate text-xs text-neutral-600 dark:text-neutral-400">{user.email}</span>
                    </span>
                </AppLink>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Sign out"
                            disabled={pending}
                            onClick={() => { void signOut() }}
                            {...prefetchProps}
                            className="shrink-0 rounded-lg text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                        >
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Sign out</TooltipContent>
                </Tooltip>
            </div>
            {/* Through a portal: the rail's transform would trap a `fixed` layer inside it. */}
            {pending && mounted ? createPortal(<SigningOutScreen />, document.body) : null}
        </>
    )
}
