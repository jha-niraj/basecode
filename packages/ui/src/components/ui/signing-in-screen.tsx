"use client"

import { SessionScreen } from "./session-screen"

/*
 * Signing in and registering: an arrow walks in through the open door. Shown from the moment the form succeeds until
 * the next page takes over, so the switch never goes blank. The mirror of `SigningOutScreen`.
 *
 *   sign in:   <SigningInScreen />                       "Welcome back" / "Taking you in"
 *   register:  <SigningInScreen title="Welcome aboard" note="Setting up your account" />
 */
export function SigningInScreen({ title = "Welcome back", note = "Taking you in" }: { title?: string; note?: string }) {
    return <SessionScreen mode="arriving" title={title} note={note} />
}

export default SigningInScreen
