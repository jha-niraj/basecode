import { HelpCircle, LayoutDashboard, NotebookPen, Settings, MessagesSquare } from "lucide-react"
import type { ShellNavSection } from "@repo/ui/lib/shell"

/**
 * Route constants (every link is built from these, never a guessed URL) and the rail. App URLs carry no hyphens.
 * Profile and Notifications are reached from the account row and the bell at the foot of the rail, so they are not
 * rail items.
 */
export const ROUTES = {
    /** Where a signed-in person lands (and the brand links): the AI page. */
    home: "/ai",
    ai: "/ai",
    dashboard: "/home",
    notes: "/notes",
    profile: "/profile",
    notifications: "/notifications",
    settings: "/settings",
    settingsNotifications: "/settings/notifications",
    settingsAppearance: "/settings/appearance",
    settingsAccounts: "/settings/accounts",
    settingsUsage: "/settings/usage",
    settingsBilling: "/settings/billing",
    onboarding: "/welcome",
    help: "/help",
    signIn: "/signin",
    accessDenied: "/accessdenied",
} as const

/** The rail pin cookie ("1" = unpinned). Each app has its own name: localhost cookies ignore the port. */
export const MAIN_RAIL_COOKIE = "app_rail_hidden"

/**
 * The rail.
 *
 * To add a module: create `app/(main)/<module>/page.tsx` (+ loading.tsx), add its route above, then an item here:
 *
 *   import { FolderKanban } from "lucide-react"
 *   { name: "Projects", href: "/projects", icon: FolderKanban, tab: true },
 *
 * `tab: true` puts it in the phone bottom bar (four at most; with none marked, the first four items go there).
 * The Notes module is the reference to copy for a new list module.
 */
export const MAIN_NAV: ShellNavSection[] = [
    {
        id: "main",
        items: [
            { name: "AI", href: ROUTES.ai, icon: MessagesSquare, tab: true },
            { name: "Home", href: ROUTES.dashboard, icon: LayoutDashboard, tab: true },
            { name: "Notes", href: ROUTES.notes, icon: NotebookPen, tab: true },
        ],
    },
    {
        id: "account",
        label: "Account",
        items: [
            { name: "Settings", href: ROUTES.settings, icon: Settings, match: "/settings", tab: true },
            { name: "Help", href: ROUTES.help, icon: HelpCircle },
        ],
    },
]
