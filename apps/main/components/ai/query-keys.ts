import type React from 'react'

// TanStack Query keys for the AI page - one key per list, so a rename or delete anywhere invalidates it.
export const AI_HISTORY_KEY = ['ai', 'history'] as const
export const AI_NEEDS_YOU_KEY = ['ai', 'needs-you'] as const
export const aiPeekKey = (kind: string, id: string) => ['ai', 'peek', kind, id] as const

/** The reading measure: the header row, the transcript, the welcome, the skeleton and the composer all use it. */
export const READING_MEASURE = 'max-w-4xl'

/**
 * The chat column of the AI page (and its skeleton): the page takes the shell's whole box (`Page bleed`), so the
 * column pads itself, and tells Page its height through `--app-col-h` (the page height minus that top padding).
 */
export const CHAT_COLUMN = 'flex min-h-0 min-w-0 flex-1 flex-col px-4 pt-3'
export const CHAT_COLUMN_STYLE = { '--app-col-h': 'calc(var(--app-page-h) - 0.75rem)' } as React.CSSProperties
