"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { signIn, signUp } from "@repo/auth/client"
import { clientErrorMessage } from "@repo/auth/errors"
import {
    AuthTitle, Divider, Field, Footnote, GoogleButton, Notice, PasswordInput, PasswordStrength, PrimaryButton, TextLink,
    authInputCls,
} from "@repo/auth/ui"
import type { GoogleMode } from "@repo/auth/google"
import { Input } from "@repo/ui/components/ui/input"
import { AUTH_ROUTES, VERIFIED_CALLBACK } from "@/lib/auth-routes"

/**
 * Name, email, password (with the strength meter), or Google. Email accounts must confirm the address before the first
 * sign-in: on success the person goes to /verifyemail, which says where the link went and can send another.
 */
export function SignUpForm({ google, returnTo, initialEmail }: { google: GoogleMode; returnTo: string; initialEmail: string }) {
    const router = useRouter()
    const [name, setName] = React.useState("")
    const [email, setEmail] = React.useState(initialEmail)
    const [password, setPassword] = React.useState("")
    const [busy, setBusy] = React.useState<null | "form" | "google">(null)
    const [error, setError] = React.useState<string | null>(null)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        if (password.length < 8) {
            setError("Use at least 8 characters for the password.")
            return
        }
        setBusy("form")
        const to = email.trim()
        const { error: err } = await signUp.email({ name: name.trim(), email: to, password, callbackURL: VERIFIED_CALLBACK })
        if (err) {
            setBusy(null)
            setError(clientErrorMessage(err))
            return
        }
        router.push(`${AUTH_ROUTES.verifyEmail}?email=${encodeURIComponent(to)}`)
    }

    async function onGoogle() {
        setError(null)
        setBusy("google")
        const { error: err } = await signIn.social({
            provider: "google",
            callbackURL: returnTo,
            errorCallbackURL: `${AUTH_ROUTES.signIn}?returnTo=${encodeURIComponent(returnTo)}`,
        })
        if (err) {
            setBusy(null)
            setError(clientErrorMessage(err))
        }
    }

    return (
        <div>
            <AuthTitle title="Create your account" sub="It takes a minute. We will confirm your email." />
            {error && <Notice tone="error">{error}</Notice>}

            {google !== "off" && (
                <>
                    <GoogleButton onClick={onGoogle} loading={busy === "google"} disabled={busy !== null && busy !== "google"} setup={google === "setup"} />
                    <Divider />
                </>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
                <Field label="Name" htmlFor="name">
                    <Input id="name" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={authInputCls} placeholder="Your name" />
                </Field>
                <Field label="Email" htmlFor="email">
                    <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={authInputCls} placeholder="you@example.com" />
                </Field>
                <Field label="Password" htmlFor="password">
                    <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" />
                    <PasswordStrength value={password} />
                </Field>
                <PrimaryButton loading={busy === "form"} disabled={busy !== null}>Create account</PrimaryButton>
            </form>

            <p className="mt-4 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                By creating an account you agree to the <TextLink href={AUTH_ROUTES.terms}>terms</TextLink> and the{" "}
                <TextLink href={AUTH_ROUTES.privacy}>privacy policy</TextLink>.
            </p>

        </div>
    )
}
