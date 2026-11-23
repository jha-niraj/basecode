/**
 * The per-turn context block - everything that changes from turn to turn. It goes AFTER the history as a
 * mid-conversation system message, and is stored with the user's message so later turns replay it unchanged (the
 * cached history prefix never moves). Never put any of this in the system prompt.
 */
export function turnContext(input: { name: string; role: string; now?: Date; page?: string }): string {
    const now = input.now ?? new Date()
    const day = now.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
    const date = now.toISOString().slice(0, 10)
    return [
        `Person: ${input.name} (${input.role === 'ADMIN' ? 'admin' : 'member'})`,
        `Today: ${day} ${date} (UTC)`,
        `Page: ${input.page ?? 'the AI page'}`,
    ].join('\n')
}
