import { BarChart3, Globe, ListChecks, NotebookPen, Search, UserRoundSearch, type LucideIcon } from 'lucide-react'

/**
 * The welcome's Create cards and Ask rows - pure data, outside the components. EXAMPLES a project replaces.
 *
 * A Create card does exactly one thing: send its prompt as a normal message, seed the composer, or open a column tab. Cards are gated on
 * what the person may DO (here the role and whether web search is on); what someone cannot use drops out and the next
 * moves up. Up to six.
 */
export interface CreateCard {
    id: string
    label: string
    hint: string
    icon: LucideIcon
    /** Sent as a typed message. */
    prompt?: string
    /** Put into the composer without sending (the person finishes the sentence). */
    seed?: string
    /** Opens a tab of the right column instead. */
    tab?: 'needs' | 'history'
    adminOnly?: boolean
    needsWeb?: boolean
}

export const CREATE_CARDS: CreateCard[] = [
    { id: 'note', label: 'Write a note', hint: 'A draft opens on the right to edit and save', icon: NotebookPen, prompt: 'Help me write a short note. Draft it for me to edit.' },
    { id: 'numbers', label: 'How are we doing', hint: 'Sign-ups and sign-ins, by window', icon: BarChart3, prompt: 'How many people signed up and signed in today, this week and this month?' },
    { id: 'find', label: 'Find a person', hint: 'Look someone up by name or email', icon: UserRoundSearch, prompt: 'Find a person for me.', adminOnly: true },
    { id: 'needs', label: 'What needs me', hint: 'The list on the right - no AI cost', icon: ListChecks, tab: 'needs' },
    { id: 'notes', label: 'My notes', hint: 'What I saved lately', icon: Search, prompt: 'Show my latest notes.' },
    { id: 'web', label: 'Search the web', hint: 'Current facts, with sources', icon: Globe, seed: 'Search the web for ', needsWeb: true },
]

export const ASK_ROWS: { id: string; text: string; adminOnly?: boolean }[] = [
    { id: 'today', text: 'How many people signed in today?' },
    { id: 'unverified', text: 'Who signed up but never verified their email?', adminOnly: true },
    { id: 'self', text: 'How often have I signed in this month?' },
    { id: 'questions', text: 'Ask me a few questions and draft a note from my answers' },
]

export function createCardsFor(opts: { isAdmin: boolean; web: boolean }): CreateCard[] {
    return CREATE_CARDS.filter((c) => (!c.adminOnly || opts.isAdmin) && (!c.needsWeb || opts.web)).slice(0, 6)
}

export function askRowsFor(opts: { isAdmin: boolean }) {
    return ASK_ROWS.filter((r) => !r.adminOnly || opts.isAdmin).slice(0, 4)
}
