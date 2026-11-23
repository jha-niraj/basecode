/**
 * Plain value lists for the Settings hub, safe in the browser (no schema import). The server reads and writes them in
 * `lib/settings.ts` and `actions/settings.action.ts`.
 */

/** What a notification is about. A topic with `emailLocked` always emails (a security notice you cannot turn off). */
export const NOTIFICATION_TOPICS = [
    { key: "account", label: "Account and security", description: "Sign-ins from a new device, password and email changes.", emailLocked: true },
    { key: "ai", label: "AI", description: "Long AI jobs finishing, and anything the AI needs you to look at." },
    { key: "billing", label: "Billing and credits", description: "Receipts, low credits, a payment that did not go through." },
    { key: "product", label: "Product updates", description: "New features and changes worth knowing about." },
] as const

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number]["key"]

export interface NotificationPreferenceView {
    topic: NotificationTopic
    email: boolean
    inApp: boolean
}

export function isNotificationTopic(value: string): value is NotificationTopic {
    return NOTIFICATION_TOPICS.some((t) => t.key === value)
}

/** user_setting keys. One place, so a typo is a type error. */
export const SETTING_KEYS = {
    density: "appearance.density",
    reducedMotion: "appearance.reducedMotion",
    useFor: "onboarding.useFor",
} as const

export type Density = "comfortable" | "compact"

export interface AppearancePrefs {
    density: Density
    reducedMotion: boolean
}

export const DEFAULT_APPEARANCE: AppearancePrefs = { density: "comfortable", reducedMotion: false }

/** The onboarding "what will you use it for" chips. */
export const USE_FOR_OPTIONS = [
    { value: "writing", label: "Writing" },
    { value: "research", label: "Research" },
    { value: "notes", label: "Notes and ideas" },
    { value: "coding", label: "Coding" },
    { value: "planning", label: "Planning" },
    { value: "learning", label: "Learning" },
    { value: "work", label: "Work tasks" },
    { value: "other", label: "Something else" },
] as const

export type UseFor = (typeof USE_FOR_OPTIONS)[number]["value"]

export function isUseFor(value: string): value is UseFor {
    return USE_FOR_OPTIONS.some((o) => o.value === value)
}
