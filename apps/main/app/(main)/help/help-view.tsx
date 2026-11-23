"use client"

import * as React from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@repo/ui/components/ui/accordion"
import { AppLink } from "@repo/ui/components/app-link"
import { Button } from "@repo/ui/components/ui/button"
import { InlineLoader } from "@repo/ui/components/ui/inline-loader"
import { InlineNote } from "@repo/ui/components/ui/inline-note"
import { Input } from "@repo/ui/components/ui/input"
import { Kbd, KbdGroup } from "@repo/ui/components/ui/kbd"
import { Label } from "@repo/ui/components/ui/label"
import { Page } from "@repo/ui/components/ui/page"
import { Textarea } from "@repo/ui/components/ui/textarea"
import { toast } from "@repo/ui/components/ui/toast"
import { sendSupportMessage } from "@/actions/help.action"
import { ROUTES } from "@/lib/navigation"
import { Section } from "../profile/_components/section"

export type ContactState = "ready" | "no-support-email" | "no-email-provider"

/** The shortcuts the app really has (use-pin-peek's Cmd/Ctrl+\, the AI page's Cmd/Ctrl+J). No command palette yet. */
const SHORTCUTS = [
    { keys: ["\\"], label: "Show or hide the side rail" },
    { keys: ["J"], label: "Jump to the message box on the AI page" },
] as const

const FAQ = [
    {
        q: "Where do my AI chats go?",
        a: "Every chat is saved to your history on the AI page - open the History tab in the right column to pick one up again.",
    },
    {
        q: "What does the AI cost me?",
        a: <>Each AI call is priced at the model's real rates and shown under <AppLink href={ROUTES.settingsUsage} className="font-medium underline underline-offset-2">Settings - AI usage</AppLink>, by day and by call.</>,
    },
    {
        q: "How do I stop an email or a notification?",
        a: <>Turn each kind on or off, by email and in the app, under <AppLink href={ROUTES.settingsNotifications} className="font-medium underline underline-offset-2">Settings - Notifications</AppLink>. Security emails always go out.</>,
    },
    {
        q: "Can I sign in with Google and a password?",
        a: <>Yes - link Google under <AppLink href={ROUTES.settingsAccounts} className="font-medium underline underline-offset-2">Connected accounts</AppLink> and set a password on your <AppLink href={`${ROUTES.profile}?tab=security`} className="font-medium underline underline-offset-2">profile</AppLink>. Both open the same account.</>,
    },
    {
        q: "How do I delete my account?",
        a: <>From your <AppLink href={`${ROUTES.profile}?tab=account`} className="font-medium underline underline-offset-2">profile's Account tab</AppLink>. It removes your data for good.</>,
    },
]

export function HelpView({ contact }: { contact: ContactState }) {
    const [isMac, setIsMac] = React.useState(true)
    React.useEffect(() => { setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) }, [])
    const mod = isMac ? "Cmd" : "Ctrl"

    return (
        <Page width="reading" title="Help" description="Shortcuts, answers and a way to reach us.">
            <div className="flex w-full flex-col gap-3">
                <Section title="Keyboard shortcuts">
                    <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {SHORTCUTS.map((s) => (
                            <li key={s.label} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                                <span className="min-w-0 text-neutral-900 dark:text-white">{s.label}</span>
                                <KbdGroup className="shrink-0">
                                    <Kbd>{mod}</Kbd>
                                    {s.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
                                </KbdGroup>
                            </li>
                        ))}
                    </ul>
                </Section>

                <Section title="Questions">
                    <Accordion type="single" collapsible className="w-full">
                        {FAQ.map((f, i) => (
                            <AccordionItem key={f.q} value={`q${i}`}>
                                <AccordionTrigger className="cursor-pointer text-sm">{f.q}</AccordionTrigger>
                                <AccordionContent className="text-sm text-neutral-700 dark:text-neutral-300">{f.a}</AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </Section>

                <ContactForm contact={contact} />
            </div>
        </Page>
    )
}

function ContactForm({ contact }: { contact: ContactState }) {
    const [subject, setSubject] = React.useState("")
    const [message, setMessage] = React.useState("")
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)
    const off = contact !== "ready"

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setBusy(true)
        const res = await sendSupportMessage({ subject, message })
        setBusy(false)
        if (!res.success) return setError(res.error ?? "Could not send the message.")
        if (res.data.status === "skipped") {
            toast.error("Not sent - email is not set up for this app yet.")
            return
        }
        setSubject("")
        setMessage("")
        toast.success("Sent - we will reply to your email")
    }

    return (
        <form onSubmit={onSubmit}>
            <Section
                title="Contact us"
                description="We reply to the email on your account."
                footer={
                    <Button type="submit" size="sm" disabled={off || busy || !subject.trim() || !message.trim()} className="gap-1.5">
                        {busy && <InlineLoader size={14} className="text-current" />}
                        Send message
                    </Button>
                }
            >
                <div className="space-y-4">
                    {off && (
                        <InlineNote tone="warning">
                            {contact === "no-support-email"
                                ? "The contact form is off: SUPPORT_EMAIL is not set for this app, so a message would go nowhere."
                                : "The contact form is off: email sending (RESEND_API_KEY) is not set up for this app yet."}
                        </InlineNote>
                    )}
                    {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
                    <div className="space-y-1.5">
                        <Label htmlFor="help-subject">Subject</Label>
                        <Input id="help-subject" value={subject} maxLength={150} disabled={off} placeholder="What is it about?" onChange={(e) => setSubject(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="help-message">Message</Label>
                        <Textarea id="help-message" value={message} maxLength={5000} rows={5} disabled={off} placeholder="What happened, and what you expected" className="field-sizing-content min-h-28" onChange={(e) => setMessage(e.target.value)} />
                    </div>
                </div>
            </Section>
        </form>
    )
}
