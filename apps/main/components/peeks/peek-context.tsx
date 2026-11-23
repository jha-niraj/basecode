'use client'

import { createContext, useContext } from 'react'

/** What a peek body may do beyond its own data: hand a prompt to the chat (through the page's one send path). */
export interface PeekActions {
    ask: (prompt: string) => void
}

const PeekActionsContext = createContext<PeekActions>({ ask: () => {} })

export const PeekActionsProvider = PeekActionsContext.Provider

export function usePeekActions(): PeekActions {
    return useContext(PeekActionsContext)
}
