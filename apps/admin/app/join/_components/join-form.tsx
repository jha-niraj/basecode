"use client"

import * as React from "react"
import { signIn } from "@repo/auth/client"
import { clientErrorMessage } from "@repo/auth/errors"
import { AuthTitle, Field, Footnote, Notice, PasswordInput, PasswordStrength, PrimaryButton, StatusMark, TextLink } from "@repo/auth/ui"
import { SigningInScreen } from "@repo/ui/components/ui/signing-in-screen"
import { joinAdminInvitation } from "@/actions/admin.action"

function roleLabel(role: string): string {
    const s = role.replace(/_/g, " ").toLowerCase()
    return s.charAt(0).toUpperCase() + s.slice(1)
}

export function JoinForm({ token, invitation, error }: {
    token: string
    invitation: { email: string; adminRole: string; name: string | null } | null
    error: string | null
}) {
    const [password, setPassword] = React.useState("")
    const [confirm, setConfirm] = React.useState("")
    const [busy, setBusy] = React.useState(false)
    const [formError, setFormError] = React.useState<string | null>(null)
    const [arriving, setArriving] = React.useState(false)
    const [joinedButSignInFailed, setJoinedButSignInFailed] = React.useState(false)
    const [keptPassword, setKeptPassword] = React.useState(false)

    if (!invitation) {
        return (
            <div>
                <StatusMark kind="error" />
                <AuthTitle title="This invitation does not work" sub={error ?? "Ask a super admin for a new invitation."} />
                <Footnote>
                    Already joined? <TextLink href="/">Sign in</TextLink>
                </Footnote>
            </div>
        )
    }

    if (arriving) return <SigningInScreen title="Welcome aboard" note="Setting up your access" />

    if (joinedButSignInFailed) {
        return (
            <div>
                <StatusMark kind="done" />
                <AuthTitle
                    title="You have joined"
                    sub={keptPassword
                        ? "This email already had an account, so its password did not change. Sign in with the password you already use."
                        : "Your access is ready. Sign in with the password you just set."}
                />
                <PrimaryButton type="button" onClick={() => window.location.assign("/")}>Sign in</PrimaryButton>
            </div>
        )
    }

    const invite = invitation

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setFormError(null)
        if (password.length < 8) return setFormError("Use at least 8 characters for the password.")
        if (password !== confirm) return setFormError("The two passwords are not the same.")
        setBusy(true)
        const joined = await joinAdminInvitation(token, password)
        if (!joined.success || !joined.data) {
            setBusy(false)
            return setFormError(joined.error ?? "The invitation could not be accepted. Try again.")
        }
        if (joined.data.passwordKept) {
            // This email already had a password; the one typed here was not applied.
            setBusy(false)
            setJoinedButSignInFailed(true)
            setKeptPassword(true)
            return
        }
        const { error: err } = await signIn.email({ email: joined.data.email, password })
        if (err) {
            console.error("[join] sign-in after joining failed:", clientErrorMessage(err))
            setBusy(false)
            setJoinedButSignInFailed(true)
            return
        }
        setArriving(true)
        window.location.assign("/home")
    }

    return (
        <div>
            <AuthTitle
                title="Accept your invitation"
                sub={<>You were invited as <span className="font-medium text-neutral-900 dark:text-white">{roleLabel(invite.adminRole)}</span>. Set a password to finish.</>}
            />
            {formError && <Notice tone="error">{formError}</Notice>}
            <form onSubmit={onSubmit} className="space-y-4">
                <Field label="Email" htmlFor="email">
                    <div id="email" className="flex h-11 items-center truncate rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                        {invite.email}
                    </div>
                </Field>
                <Field label="Password" htmlFor="password">
                    <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="At least 8 characters" autoFocus />
                    <PasswordStrength value={password} />
                </Field>
                <Field label="Confirm password" htmlFor="confirm">
                    <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
                </Field>
                <PrimaryButton loading={busy}>Join and sign in</PrimaryButton>
            </form>
        </div>
    )
}
