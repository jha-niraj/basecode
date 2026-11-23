import { ArrowRight, KeyRound, MessagesSquare, ShieldCheck } from "lucide-react"
import { SITE } from "@repo/core/site"
import { AppLink } from "@repo/ui/components/app-link"
import { Button } from "@repo/ui/components/ui/button"

/**
 * The public landing - minimal and neutral on purpose: a clone replaces it with its own. Static (no session read), so
 * it renders from the edge cache; the middleware sends a signed-in visitor from /signin straight to /ai.
 */
const POINTS = [
    { icon: MessagesSquare, title: "An AI workspace", body: "A full-page chat with questions and confirmations in a side column." },
    { icon: KeyRound, title: "Sign-in that works", body: "Email and password, Google, and one-time email codes." },
    { icon: ShieldCheck, title: "An admin console", body: "Team, access, users, audit log and system settings." },
]

export default function LandingPage() {
    return (
        <div className="flex min-h-dvh flex-col bg-white text-neutral-900 dark:bg-[#121314] dark:text-neutral-100">
            <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
                <AppLink href="/" className="flex cursor-pointer items-center gap-2.5 rounded-lg">
                    <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-xs font-semibold text-white dark:bg-white dark:text-neutral-900">
                        {SITE.name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-semibold">{SITE.name}</span>
                </AppLink>
                <nav className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm" className="cursor-pointer rounded-xl">
                        <AppLink href="/signin">Sign in</AppLink>
                    </Button>
                    <Button asChild size="sm" className="cursor-pointer rounded-xl">
                        <AppLink href="/signup">Get started</AppLink>
                    </Button>
                </nav>
            </header>

            <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
                <div className="max-w-2xl">
                    <h1 className="text-4xl font-semibold tracking-tight">{SITE.tagline}</h1>
                    <p className="mt-4 text-base leading-7 text-neutral-600 dark:text-neutral-400">{SITE.description}</p>
                    <div className="mt-8 flex flex-col gap-2 sm:flex-row">
                        <Button asChild className="h-11 cursor-pointer gap-2 rounded-xl px-5">
                            <AppLink href="/signup">Get started <ArrowRight className="h-4 w-4" /></AppLink>
                        </Button>
                        <Button asChild variant="outline" className="h-11 cursor-pointer rounded-xl px-5">
                            <AppLink href="/signin">I have an account</AppLink>
                        </Button>
                    </div>
                </div>

                <ul className="mt-16 grid gap-3 sm:grid-cols-3">
                    {POINTS.map(({ icon: Icon, title, body }) => (
                        <li key={title} className="rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.04] dark:bg-neutral-900 dark:ring-white/[0.06]">
                            <Icon className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                            <h2 className="mt-3 text-base font-semibold">{title}</h2>
                            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{body}</p>
                        </li>
                    ))}
                </ul>
            </main>

            <footer className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-neutral-400">
                <span>{SITE.name}</span>
                <span className="flex gap-4">
                    <AppLink href="/terms" className="cursor-pointer hover:text-neutral-900 dark:hover:text-white">Terms</AppLink>
                    <AppLink href="/privacy" className="cursor-pointer hover:text-neutral-900 dark:hover:text-white">Privacy</AppLink>
                </span>
            </footer>
        </div>
    )
}
