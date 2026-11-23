/** One signed-in device on the Sessions tab. The token never leaves the server. */
export interface ProfileSessionRow {
    id: string
    userAgent: string | null
    ipAddress: string | null
    createdAt: string
    updatedAt: string
    current: boolean
}

export interface ProfileData {
    id: string
    name: string
    email: string
    bio: string
    /** href for <img>, or null for initials. */
    avatarSrc: string | null
    /** True when the stored avatar is one of OURS (an R2 key) - only then is "Remove photo" offered. */
    hasUploadedAvatar: boolean
    /** Has an email + password login (false for Google-only / code-only accounts: they get "Set a password"). */
    hasPassword: boolean
    /** Sign-in methods linked, e.g. ["credential", "google"]. */
    providers: string[]
    storageReady: boolean
    emailVerified: boolean
    createdAt: string
}
