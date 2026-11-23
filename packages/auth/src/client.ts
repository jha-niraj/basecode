'use client'

/**
 * The browser side of auth. Client components import from here, never from `better-auth/*`.
 *
 *   const { data, isPending } = useSession()
 *   await signIn.email({ email, password })
 *   await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' }); await signIn.emailOtp({ email, otp })
 *   const { signOut, pending } = useSignOut()
 */
import { useCallback, useRef, useState } from 'react'
import { createAuthClient } from 'better-auth/react'
import { emailOTPClient, inferAdditionalFields } from 'better-auth/client/plugins'
import type { Auth } from './server'
import { SIGN_OUT_PATH } from './sign-out'

// No baseURL: the client talks to the origin it was loaded from (each app serves its own /api/auth).
export const authClient = createAuthClient({
    plugins: [inferAdditionalFields<Auth>(), emailOTPClient()],
})

export const { signIn, signUp, useSession } = authClient

export interface UseSignOutOptions {
    /** Where to land. Main: `/signin`; admin: `/`. */
    signInPath?: string
    /** Anything to drop before leaving (e.g. `queryClient.clear()`). Never throws out. */
    onSignedOut?: () => void | Promise<void>
}

export interface SignOutHandle {
    /** Signs out and hard-navigates to the sign-in page. Resolves false only when the request never reached the server. */
    signOut: () => Promise<boolean>
    /** True from the click until the page leaves. */
    pending: boolean
}

/**
 * THE sign-out: one `POST /api/sign-out` (worker.ts answers it before Next: cookies expired, 204; better-auth's own
 * sign-out runs behind the reply), then a HARD navigation to the sign-in page so no cached page or query of the person
 * who left survives. Any HTTP answer counts as signed out (a 401 means the session already ended elsewhere); only a
 * network failure keeps the person here.
 */
export function useSignOut({ signInPath = '/signin', onSignedOut }: UseSignOutOptions = {}): SignOutHandle {
    const [pending, setPending] = useState(false)
    const busy = useRef(false)

    const signOut = useCallback(async (): Promise<boolean> => {
        if (busy.current) return false
        busy.current = true
        setPending(true)
        try {
            await fetch(SIGN_OUT_PATH, {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'content-type': 'application/json' },
                body: '{}',
            })
        } catch {
            busy.current = false
            setPending(false)
            return false
        }
        try {
            await onSignedOut?.()
        } catch (err) {
            console.error('[sign-out] clean-up failed (signed out anyway):', err)
        }
        window.location.assign(signInPath)
        return true
    }, [signInPath, onSignedOut])

    return { signOut, pending }
}
