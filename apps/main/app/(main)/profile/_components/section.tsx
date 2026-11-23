import type { ReactNode } from "react"

/**
 * One flat section of a profile tab: a heading, one line, the content. Neutral card, words carry the state.
 * `action`: a single control that sits on the heading's row (right side) instead of below it - a one-button section is
 * one row, never a card with a lonely button under the text. On a phone it drops under the text.
 */
export function Section({ title, description, children, footer, action }: {
    title: string
    description?: ReactNode
    children?: ReactNode
    footer?: ReactNode
    action?: ReactNode
}) {
    return (
        <section className="rounded-2xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <div className="p-4 sm:p-5">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h2>
                        {description && <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">{description}</p>}
                    </div>
                    {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
                </div>
                {children && <div className="mt-4">{children}</div>}
            </div>
            {footer && (
                <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 sm:px-5 dark:border-neutral-800">{footer}</div>
            )}
        </section>
    )
}

export function initials(name: string, email: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    const s = parts.length >= 2 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : (parts[0] ?? email).slice(0, 2)
    return s.toUpperCase()
}
