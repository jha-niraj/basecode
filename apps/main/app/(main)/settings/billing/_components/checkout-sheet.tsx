"use client"

import * as React from "react"
import { CreditCard, Lock } from "lucide-react"
import {
    CURRENCY_LABELS, findPack, formatCredits, formatMoney, PLANS, planPrice, TERMS, type BillingCurrency, type TermMonths,
} from "@repo/billing/plans"
import type { ProviderSummary } from "@repo/payments"
import { Button } from "@repo/ui/components/ui/button"
import { InlineLoader } from "@repo/ui/components/ui/inline-loader"
import { Input } from "@repo/ui/components/ui/input"
import { Label } from "@repo/ui/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@repo/ui/components/ui/radio-group"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet"
import { Switch } from "@repo/ui/components/ui/switch"
import { toast } from "@repo/ui/components/ui/toast"
import { startBillingCheckout } from "@/actions/billing.action"
import { launchCheckout } from "./launch-checkout"
import { CurrencySelect } from "./currency-select"

export type CheckoutIntent = { kind: "plan"; autoRenew: boolean } | { kind: "credits"; pack: string }

/**
 * One checkout in the right sheet: what is being bought, how long (1 / 3 / 12 months, or monthly auto-renew where a
 * gateway supports it), and how to pay - only the providers that take this currency AND are set up. Pressing Pay
 * stores the payment and hands the browser to the gateway; prices are worked out on the server, never sent from here.
 */
export function CheckoutSheet({ intent, open, onOpenChange, onExitComplete, currency, onCurrencyChange, providers, autoRenewActive }: {
    intent: CheckoutIntent | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onExitComplete: () => void
    currency: BillingCurrency
    onCurrencyChange: (c: BillingCurrency) => void
    providers: Record<BillingCurrency, ProviderSummary[]>
    /** An auto-renewing plan already runs - auto-renew cannot be started again. */
    autoRenewActive: boolean
}) {
    const [months, setMonths] = React.useState<TermMonths>(1)
    const [autoRenew, setAutoRenew] = React.useState(false)
    const [providerId, setProviderId] = React.useState<string>("")
    const [phone, setPhone] = React.useState("")
    const [pending, setPending] = React.useState(false)

    // A new intent (a different button) starts from its own defaults.
    React.useEffect(() => {
        if (!intent) return
        setAutoRenew(intent.kind === "plan" ? intent.autoRenew && !autoRenewActive : false)
        setMonths(1)
    }, [intent, autoRenewActive])

    const all = providers[currency] ?? []
    const canAutoRenew = intent?.kind === "plan" && !autoRenewActive && all.some((p) => p.subscriptions)
    const wantsAuto = canAutoRenew && autoRenew
    const offered = wantsAuto ? all.filter((p) => p.subscriptions) : all
    const chosen = offered.find((p) => p.id === providerId) ?? offered[0] ?? null

    const pack = intent?.kind === "credits" ? findPack(intent.pack) : null
    const amount = intent?.kind === "plan" ? planPrice("pro", currency, wantsAuto ? 1 : months) : pack ? pack.price[currency] : null
    const title = intent?.kind === "plan" ? "Pro plan" : pack ? `${formatCredits(pack.credits)} credits` : "Checkout"

    const pay = async () => {
        if (!intent || !chosen || amount === null) return
        setPending(true)
        const base = { currency, provider: chosen.id, ...(chosen.id === "cashfree" ? { phone } : {}) }
        const r = intent.kind === "plan"
            ? await startBillingCheckout({ kind: "plan", plan: "pro", months: wantsAuto ? 1 : months, autoRenew: wantsAuto, ...base })
            : await startBillingCheckout({ kind: "credits", pack: intent.pack, ...base })
        if (!r.success) {
            setPending(false)
            toast.error(r.error ?? "The payment could not be started. Try again.")
            return
        }
        try {
            await launchCheckout(r.data.start, {
                onDismiss: () => {
                    setPending(false)
                    toast.message("Payment window closed. Nothing was charged.")
                },
            })
        } catch (err) {
            setPending(false)
            toast.error(err instanceof Error ? err.message : "The payment could not be started. Try again.")
        }
    }

    const phoneOk = chosen?.id !== "cashfree" || phone.replace(/\D/g, "").length >= 10

    return (
        <Sheet open={open} onOpenChange={onOpenChange} onExitComplete={() => { setPending(false); setProviderId(""); onExitComplete() }}>
            <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                    <SheetDescription>
                        {intent?.kind === "plan" ? PLANS.pro.summary : "Credits pay for AI. They never expire."}
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea orientation="vertical" className="-mx-6 min-h-0 flex-1">
                    <div className="flex min-w-0 flex-col gap-5 px-6 pb-2">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <Label>Currency</Label>
                            <CurrencySelect value={currency} onChange={onCurrencyChange} className="w-full" />
                        </div>

                        {intent?.kind === "plan" ? (
                            <>
                                {canAutoRenew ? (
                                    <div className="flex min-w-0 items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-neutral-900 dark:text-white">Renew automatically</p>
                                            <p className="text-xs text-neutral-600 dark:text-neutral-400">Charged every month until you turn it off.</p>
                                        </div>
                                        <Switch checked={autoRenew} onCheckedChange={setAutoRenew} aria-label="Renew automatically" />
                                    </div>
                                ) : null}
                                {!wantsAuto ? (
                                    <div className="flex min-w-0 flex-col gap-1.5">
                                        <Label>How long</Label>
                                        <RadioGroup value={String(months)} onValueChange={(v) => setMonths(Number(v) as TermMonths)} className="gap-2">
                                            {TERMS.map((t) => {
                                                const price = planPrice("pro", currency, t.months)
                                                return (
                                                    <Label
                                                        key={t.months}
                                                        htmlFor={`term-${t.months}`}
                                                        className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 dark:border-neutral-800"
                                                    >
                                                        <RadioGroupItem id={`term-${t.months}`} value={String(t.months)} />
                                                        <span className="min-w-0 flex-1 truncate text-sm text-neutral-900 dark:text-white">{t.label}</span>
                                                        {t.discountPercent ? <span className="shrink-0 text-xs text-neutral-600 dark:text-neutral-400">{t.discountPercent}% off</span> : null}
                                                        <span className="shrink-0 text-sm font-medium tabular-nums text-neutral-900 dark:text-white">{price !== null ? formatMoney(price, currency) : "-"}</span>
                                                    </Label>
                                                )
                                            })}
                                        </RadioGroup>
                                    </div>
                                ) : null}
                            </>
                        ) : null}

                        <div className="flex min-w-0 flex-col gap-1.5">
                            <Label>Pay with</Label>
                            {offered.length === 0 ? (
                                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                                    {wantsAuto
                                        ? `No payment method for ${CURRENCY_LABELS[currency]} can renew automatically yet. Turn automatic renewal off to pay for a set number of months.`
                                        : `No payment method is set up for ${CURRENCY_LABELS[currency]} yet. Choose another currency.`}
                                </p>
                            ) : (
                                <RadioGroup value={chosen?.id ?? ""} onValueChange={setProviderId} className="gap-2">
                                    {offered.map((p) => (
                                        <Label
                                            key={p.id}
                                            htmlFor={`provider-${p.id}`}
                                            className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 dark:border-neutral-800"
                                        >
                                            <RadioGroupItem id={`provider-${p.id}`} value={p.id} />
                                            <span className="min-w-0 flex-1 truncate text-sm text-neutral-900 dark:text-white">{p.label}</span>
                                            {p.testMode ? <span className="shrink-0 text-xs text-neutral-600 dark:text-neutral-400">Test mode</span> : null}
                                        </Label>
                                    ))}
                                </RadioGroup>
                            )}
                        </div>

                        {chosen?.id === "cashfree" ? (
                            <div className="flex min-w-0 flex-col gap-1.5">
                                <Label htmlFor="billing-phone">Mobile number</Label>
                                <Input id="billing-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                                    placeholder="10-digit mobile number" className="h-9 rounded-xl text-sm" />
                                <p className="text-xs text-neutral-600 dark:text-neutral-400">Cashfree needs a mobile number for the payment.</p>
                            </div>
                        ) : null}

                        <p className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                            <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            You pay on the provider&apos;s own page. We never see your card or wallet details.
                        </p>
                    </div>
                </ScrollArea>
                <SheetFooter>
                    <Button type="button" variant="outline" className="cursor-pointer rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="button" className="cursor-pointer gap-2 rounded-xl" disabled={pending || !chosen || amount === null || !phoneOk} onClick={pay}>
                        {pending ? <InlineLoader size={14} label="Starting payment" /> : <CreditCard className="h-4 w-4" />}
                        {amount !== null ? `Pay ${formatMoney(amount, currency)}${wantsAuto ? " a month" : ""}` : "Pay"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}
