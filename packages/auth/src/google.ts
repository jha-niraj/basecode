/**
 * Whether the auth pages show "Continue with Google". `on` when both keys are set; in development without keys `setup`
 * shows the button disabled with the two variables to set (so it never looks missing); in production without keys `off`
 * hides it. Server-safe (no "use client"): pages compute it and pass it down.
 */
export type GoogleMode = 'on' | 'setup' | 'off'

export function googleMode(configured: boolean): GoogleMode {
    if (configured) return 'on'
    return process.env.NODE_ENV === 'production' ? 'off' : 'setup'
}
