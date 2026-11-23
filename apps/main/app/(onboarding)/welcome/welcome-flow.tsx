"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Camera, Check } from "lucide-react"
import { SITE } from "@repo/core/site"
import { AppLink, markNavPending } from "@repo/ui/components/app-link"
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar"
import { Button } from "@repo/ui/components/ui/button"
import { Checkbox } from "@repo/ui/components/ui/checkbox"
import { FlowSteps } from "@repo/ui/components/ui/flow-steps"
import { InlineLoader } from "@repo/ui/components/ui/inline-loader"
import { Input } from "@repo/ui/components/ui/input"
import { Label } from "@repo/ui/components/ui/label"
import { toast } from "@repo/ui/components/ui/toast"
import { cn } from "@repo/ui/lib/utils"
import { getAvatarUploadUrl, saveAvatar } from "@/actions/profile.action"
import { acceptLegal, finishOnboarding, saveUseFor, saveWelcomeName } from "@/actions/onboarding.action"
import { AUTH_ROUTES } from "@/lib/auth-routes"
import { ROUTES } from "@/lib/navigation"
import { USE_FOR_OPTIONS, type UseFor } from "@/lib/settings-values"
import { AVATAR_ACCEPT, cropAvatar } from "../../(main)/profile/_components/avatar-image"
import { initials } from "../../(main)/profile/_components/section"

export interface WelcomeData {
    name: string
    email: string
    avatarSrc: string | null
    hasUploadedAvatar: boolean
    storageReady: boolean
    useFor: UseFor[]
    legalAccepted: boolean
}

const STEPS = ["You", "Your use", "Terms", "Done"] as const

/**
 * One card, four steps, Back / Next. Each Next saves its own step, so leaving half way keeps what was done; the last
 * step marks the account onboarded and lands on the AI page.
 */
export function WelcomeFlow({ data }: { data: WelcomeData }) {
    const router = useRouter()
    const [step, setStep] = React.useState(0)
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const [name, setName] = React.useState(data.name)
    const [savedName, setSavedName] = React.useState(data.name)
    const [src, setSrc] = React.useState<string | null>(data.avatarSrc)
    const [uploading, setUploading] = React.useState(false)
    const fileRef = React.useRef<HTMLInputElement>(null)

    const [useFor, setUseFor] = React.useState<UseFor[]>(data.useFor)
    const [agreed, setAgreed] = React.useState(data.legalAccepted)
    const [legalDone, setLegalDone] = React.useState(data.legalAccepted)

    async function onFile(file: File) {
        setUploading(true)
        try {
            const blob = await cropAvatar(file)
            const presign = await getAvatarUploadUrl({ contentType: "image/jpeg", size: blob.size })
            if (!presign.success) throw new Error(presign.error ?? "Could not start the upload.")
            const put = await fetch(presign.data.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } })
            if (!put.ok) throw new Error("The upload did not go through. Try again.")
            const saved = await saveAvatar(presign.data.key)
            if (!saved.success) throw new Error(saved.error ?? "Could not save the photo.")
            setSrc(saved.data.src)
            toast.success("Photo added")
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not add the photo.")
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ""
        }
    }

    async function next() {
        setError(null)
        setBusy(true)
        try {
            if (step === 0) {
                if (!name.trim()) return setError("Enter your name.")
                if (name.trim() !== savedName) {
                    const res = await saveWelcomeName({ name })
                    if (!res.success) return setError(res.error ?? "Could not save your name.")
                    setSavedName(res.data.name)
                    setName(res.data.name)
                }
            } else if (step === 1) {
                const res = await saveUseFor({ values: useFor })
                if (!res.success) return setError(res.error ?? "Could not save that.")
            } else if (step === 2) {
                if (!agreed) return setError("Accept the terms and the privacy policy to continue.")
                if (!legalDone) {
                    const res = await acceptLegal()
                    if (!res.success) return setError(res.error ?? "Could not record that.")
                    setLegalDone(true)
                }
            } else {
                const res = await finishOnboarding()
                if (!res.success) return setError(res.error ?? "Could not finish.")
                markNavPending(ROUTES.ai)
                router.push(ROUTES.ai)
                return
            }
            setStep((s) => Math.min(STEPS.length - 1, s + 1))
        } finally {
            setBusy(false)
        }
    }

    const toggleUse = (v: UseFor) => setUseFor((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]))

    return (
        <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <div className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
                <FlowSteps steps={STEPS} current={step} size="sm" onStepClick={(i) => { setError(null); setStep(i) }} />
            </div>

            <form
                className="flex flex-col"
                onSubmit={(e) => {
                    e.preventDefault()
                    void next()
                }}
            >
                <div className="min-h-[18rem] px-5 py-5">
                    {step === 0 && (
                        <div className="space-y-5">
                            <StepHead title={`Welcome to ${SITE.name}`} line="Start with your name and, if you like, a photo." />
                            <div className="flex min-w-0 items-center gap-4">
                                <Avatar className="size-16 shrink-0">
                                    {src && <AvatarImage src={src} alt="" />}
                                    <AvatarFallback className="bg-neutral-100 text-base font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                                        {initials(name || data.name, data.email)}
                                    </AvatarFallback>
                                </Avatar>
                                {data.storageReady ? (
                                    <>
                                        <input ref={fileRef} type="file" accept={AVATAR_ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />
                                        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={uploading} onClick={() => fileRef.current?.click()}>
                                            {uploading ? <InlineLoader size={14} /> : <Camera className="size-4" />}
                                            {src ? "Change photo" : "Add a photo"}
                                        </Button>
                                    </>
                                ) : (
                                    <p className="min-w-0 text-xs text-neutral-600 dark:text-neutral-400">Photo uploads are not set up yet, so your initials are shown.</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="welcome-name">Your name</Label>
                                <Input id="welcome-name" value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-5">
                            <StepHead title="What will you use it for?" line="Pick any that fit. It helps the AI start in the right place - you can skip this." />
                            <div className="flex flex-wrap gap-2" role="group" aria-label="Uses">
                                {USE_FOR_OPTIONS.map((o) => {
                                    const on = useFor.includes(o.value)
                                    return (
                                        <Button
                                            key={o.value}
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            aria-pressed={on}
                                            onClick={() => toggleUse(o.value)}
                                            className={cn(
                                                "gap-1.5 rounded-full",
                                                on && "border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 hover:text-white dark:border-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200",
                                            )}
                                        >
                                            {on && <Check className="h-3.5 w-3.5" />}
                                            {o.label}
                                        </Button>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-5">
                            <StepHead title="The terms" line="Please read them - they say what we do with your data and what you can expect from us." />
                            <ul className="space-y-1.5 text-sm">
                                <li><AppLink href={AUTH_ROUTES.terms} target="_blank" className="font-medium text-neutral-900 underline underline-offset-2 dark:text-white">Terms of service</AppLink></li>
                                <li><AppLink href={AUTH_ROUTES.privacy} target="_blank" className="font-medium text-neutral-900 underline underline-offset-2 dark:text-white">Privacy policy</AppLink></li>
                            </ul>
                            <label htmlFor="welcome-legal" className="flex cursor-pointer items-start gap-2.5 text-sm text-neutral-800 dark:text-neutral-200">
                                <Checkbox id="welcome-legal" checked={agreed} disabled={legalDone} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
                                <span>I accept the terms of service and the privacy policy.{legalDone && <span className="ml-1 text-neutral-600 dark:text-neutral-400">Accepted.</span>}</span>
                            </label>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-5">
                            <StepHead title={`You are set, ${savedName.split(/\s+/)[0] || "there"}`} line="Next you land on the AI page. Ask it anything - your notes, settings and help are in the rail on the left." />
                            <ul className="space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-neutral-500" /> Name {src ? "and photo " : ""}saved</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-neutral-500" /> {useFor.length > 0 ? `${useFor.length} ${useFor.length === 1 ? "use" : "uses"} picked` : "Uses skipped - change them any time"}</li>
                                <li className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-neutral-500" /> Terms and privacy accepted</li>
                            </ul>
                        </div>
                    )}

                    {error && <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-neutral-200 px-5 py-3 dark:border-neutral-800">
                    <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={step === 0 || busy} onClick={() => { setError(null); setStep((s) => Math.max(0, s - 1)) }}>
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </Button>
                    <Button type="submit" size="sm" className="gap-1.5" disabled={busy || uploading || (step === 2 && !agreed)}>
                        {busy && <InlineLoader size={14} className="text-current" />}
                        {step === STEPS.length - 1 ? "Open the AI page" : step === 1 && useFor.length === 0 ? "Skip" : "Next"}
                        {!busy && <ArrowRight className="h-3.5 w-3.5" />}
                    </Button>
                </div>
            </form>
        </section>
    )
}

function StepHead({ title, line }: { title: string; line: string }) {
    return (
        <div>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white">{title}</h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{line}</p>
        </div>
    )
}
