"use client"

import { SessionScreen } from "./session-screen"

/*
 * Signing out: the arrow walks out of the door. Shown from the click until the redirect lands, so the wait is never a
 * dead button. Render it through a portal from a menu (a menu's own transform would trap a `fixed` layer).
 */
export function SigningOutScreen({ label = "Signing you out", note = "See you soon" }: { label?: string; note?: string }) {
    return <SessionScreen mode="leaving" title={label} note={note} />
}

export default SigningOutScreen
