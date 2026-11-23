/** The signed-in person as the app sees them (`getSession()` in lib/session.ts). `image` is already an href. */
export interface AppSessionUser {
    id: string
    name: string
    email: string
    /** Ready for `<img src>` (storageHref of the stored key, or a Google URL), or null for the initials avatar. */
    image: string | null
    role: string
    emailVerified: boolean
    bio: string | null
}

export interface AppSession {
    session: { id: string; expiresAt: Date }
    user: AppSessionUser
}
