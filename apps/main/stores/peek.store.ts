import { create } from 'zustand'

/**
 * The open peek, as a stack of `/peek/<kind>/<id>` hrefs: the top is shown, Back pops it. One stack for every place
 * that draws it - the AI page's right column (`columnHost`, wide screens) and the bottom sheet on a phone.
 */
interface PeekState {
    stack: string[]
    columnHost: boolean
    /** Open over whatever is showing; `fresh` starts a new stack (a chat link, a Needs you row). */
    open: (href: string, opts?: { fresh?: boolean }) => void
    back: () => void
    close: () => void
    setColumnHost: (on: boolean) => void
}

export const usePeekStore = create<PeekState>((set) => ({
    stack: [],
    columnHost: false,
    open: (href, opts) => set((s) => {
        if (opts?.fresh) return { stack: [href] }
        if (s.stack[s.stack.length - 1] === href) return s
        // Re-opening something already below unwinds to it instead of piling up. Capped at 8.
        const at = s.stack.indexOf(href)
        return { stack: at === -1 ? [...s.stack, href].slice(-8) : s.stack.slice(0, at + 1) }
    }),
    back: () => set((s) => ({ stack: s.stack.slice(0, -1) })),
    close: () => set({ stack: [] }),
    setColumnHost: (on) => set({ columnHost: on }),
}))
