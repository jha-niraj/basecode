"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarClock, Coins, Gauge, Receipt, Gem } from "lucide-react"
import type { BillingOverview } from "@repo/billing"
import {
    BILLING_CURRENCIES, CREDIT_PACKS, formatCredits, formatMoney, PLANS, planPrice, type BillingCurrency,
} from "@repo/billing/plans"
import { AppLink } from "@repo/ui/components/app-link"
import { Button } from "@repo/ui/components/ui/button"
import { ConfirmPopover } from "@repo/ui/components/ui/confirm-popover"
import { EmptyState } from "@repo/ui/components/ui/empty-state"
import { Page } from "@repo/ui/components/ui/page"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { PanelRow, PanelRows, SectionPanel } from "@repo/ui/components/ui/section-panel"
import { StatBand } from "@repo/ui/components/ui/stat-band"
import { Switch } from "@repo/ui/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/ui/table"
import { toast } from "@repo/ui/components/ui/toast"
import { getBillingOverview, saveBillingCurrency, turnOffAutoRenew } from "@/actions/billing.action"
import { BILLING_DESCRIPTION, BILLING_TITLE, BillingSkeleton } from "./billing-skeleton"
import { BILLING_KEYS, formatBillingDate, PROVIDER_NAMES, STATUS_LABELS } from "./billing-keys"
import { CheckoutSheet, type CheckoutIntent } from "./checkout-sheet"
import { CurrencySelect } from "./currency-select"

async function fetchOverview(): Promise<BillingOverview> {
    const r = await getBillingOverview()
    if (!r.success) throw new Error(r.error ?? "Billing could not be loaded.")
    return r.data
}

function defaultCurrency(o: BillingOverview): BillingCurrency {
    if (o.currency) return o.currency
    return BILLING_CURRENCIES.find((c) => o.providers[c]?.length) ?? "USD"
}

function describePayment(p: BillingOverview["payments"][number]): string {
    if (p.kind === "credits") return `${formatCredits(p.credits ?? 0)} credits`
    if (p.kind === "renewal") return `${PLANS.pro.name} plan, monthly renewal`
    if (p.autoRenew) return `${PLANS.pro.name} plan, renews monthly`
    return `${PLANS.pro.name} plan, ${p.termMonths ?? 1} month${p.termMonths === 1 ? "" : "s"}`
}

/**
 * The billing page: what plan you are on and until when, your credits, top-up packs, and every payment. Buying opens
 * the checkout sheet; the browser then goes to the gateway and comes back to /checkout/<id>, which shows the result.
 */
export function BillingView({ initial }: { initial: BillingOverview }) {
    const queryClient = useQueryClient()
    const overview = useQuery({ queryKey: BILLING_KEYS.overview, queryFn: fetchOverview, initialData: initial })
    const o = overview.data
    const [currency, setCurrency] = React.useState<BillingCurrency>(() => defaultCurrency(initial))
    const [intent, setIntent] = React.useState<CheckoutIntent | null>(null)
    const [sheetOpen, setSheetOpen] = React.useState(false)

    const changeCurrency = (c: BillingCurrency) => {
        setCurrency(c)
        void saveBillingCurrency(c)
    }

    const autoOff = useMutation({
        mutationFn: async () => {
            const r = await turnOffAutoRenew()
            if (!r.success) throw new Error(r.error ?? "Automatic renewal could not be turned off.")
        },
        onSuccess: async () => {
            toast.success("Automatic renewal is off. Your plan runs to the end of the paid period.")
            await queryClient.invalidateQueries({ queryKey: BILLING_KEYS.all })
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Automatic renewal could not be turned off."),
    })

    if (!o) return <BillingSkeleton />

    const open = (next: CheckoutIntent) => { setIntent(next); setSheetOpen(true) }
    const sub = o.subscription
    const pro = PLANS.pro
    const monthly = planPrice("pro", currency, 1)
    const endsLabel = o.active && sub ? (sub.autoRenew ? "Renews" : "Ends") : "Paid until"
    const providersHere = o.providers[currency] ?? []
    const autoCapable = providersHere.some((p) => p.subscriptions)

    return (
        <Page
            title={BILLING_TITLE}
            description={BILLING_DESCRIPTION}
            body="page"
            extra={<CurrencySelect value={currency} onChange={changeCurrency} />}
        >
            <div className="flex min-w-0 flex-col gap-4">
                <StatBand
                    items={[
                        { icon: Gem, label: "Plan", value: o.active ? PLANS[o.plan].name : PLANS.free.name, hint: o.active && sub?.autoRenew ? "renews monthly" : undefined },
                        {
                            icon: CalendarClock,
                            label: endsLabel,
                            value: o.active && sub ? formatBillingDate(sub.currentPeriodEnd) : "No paid period",
                            hint: o.active && sub?.status === "past_due" ? "payment retrying" : undefined,
                            tone: o.active && sub?.status === "past_due" ? "amber" : undefined,
                        },
                        { icon: Coins, label: "Credits", value: formatCredits(o.creditBalance), tone: o.creditBalance <= 0 ? "rose" : undefined, hint: o.creditBalance <= 0 ? "top up to use AI" : "available" },
                        { icon: Gauge, label: "Spent", value: formatCredits(o.spentThisMonth), hint: "credits this month" },
                    ]}
                />

                <div className="grid min-w-0 gap-3 lg:grid-cols-2">
                    <SectionPanel
                        title="Plan"
                        description={o.active ? `${pro.name} - ${pro.features[0]}` : `${PLANS.free.name} - ${PLANS.free.summary}`}
                        className="h-full"
                    >
                        <PanelRows>
                            <PanelRow label="Current plan">{o.active ? PLANS[o.plan].name : PLANS.free.name}</PanelRow>
                            {o.active && sub ? (
                                <PanelRow label={sub.autoRenew ? "Renews on" : "Ends on"}>{formatBillingDate(sub.currentPeriodEnd)}</PanelRow>
                            ) : null}
                            {o.active && sub ? (
                                <PanelRow
                                    label="Renew automatically"
                                    action={sub.autoRenew && sub.canCancelAutoRenew ? (
                                        <ConfirmPopover
                                            title="Turn off automatic renewal?"
                                            description={`Your plan stays until ${formatBillingDate(sub.currentPeriodEnd)}, then moves to Free.`}
                                            confirmLabel="Turn off"
                                            onConfirm={() => autoOff.mutateAsync()}
                                        >
                                            <span><Switch checked aria-label="Renew automatically" disabled={autoOff.isPending} /></span>
                                        </ConfirmPopover>
                                    ) : !sub.autoRenew && autoCapable ? (
                                        <Switch checked={false} aria-label="Renew automatically" onCheckedChange={(v) => { if (v) open({ kind: "plan", autoRenew: true }) }} />
                                    ) : undefined}
                                >
                                    {sub.autoRenew ? `On, ${sub.amountMinor && sub.currency ? formatMoney(sub.amountMinor, sub.currency) : "monthly"} a month` : autoCapable ? "Off" : "Not available for this currency"}
                                </PanelRow>
                            ) : null}
                            <PanelRow label={pro.name}>{monthly !== null ? `${formatMoney(monthly, currency)} a month, less for 3 or 12 months` : "Not sold in this currency"}</PanelRow>
                        </PanelRows>
                        {!(o.active && sub?.autoRenew) ? (
                            <div className="mt-3 flex justify-end">
                                <Button size="sm" className="cursor-pointer rounded-xl" disabled={monthly === null} data-sheet-keep-open="" onClick={() => open({ kind: "plan", autoRenew: false })}>
                                    {o.active ? "Add months" : `Upgrade to ${pro.name}`}
                                </Button>
                            </div>
                        ) : null}
                    </SectionPanel>

                    <SectionPanel title="Credits" description="AI spends credits as you use it. Top up any time." className="h-full">
                        <PanelRows>
                            {CREDIT_PACKS.map((p) => (
                                <PanelRow
                                    key={p.code}
                                    label={`${formatCredits(p.credits)} credits`}
                                    action={(
                                        <Button size="sm" variant="outline" className="cursor-pointer rounded-xl" data-sheet-keep-open="" onClick={() => open({ kind: "credits", pack: p.code })}>
                                            Buy
                                        </Button>
                                    )}
                                >
                                    {formatMoney(p.price[currency], currency)}
                                </PanelRow>
                            ))}
                        </PanelRows>
                    </SectionPanel>
                </div>

                <SectionPanel title="Payments" description="Every payment on this account, newest first." variant="data">
                    {o.payments.length === 0 ? (
                        <EmptyState icon={<Receipt className="h-6 w-6" />} title="No payments yet" description="Plans and credit top-ups you buy show here." />
                    ) : (
                        <ScrollArea orientation="both" viewportClassName="max-h-[30rem]" className="rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-800">
                            <div className="min-w-[640px]">
                                <Table scroller="parent">
                                    <TableHeader sticky>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>What</TableHead>
                                            <TableHead>Paid with</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead pin="end"><span className="sr-only">Open</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {o.payments.map((p) => (
                                            <TableRow key={p.id}>
                                                <TableCell className="whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">{formatBillingDate(p.createdAt)}</TableCell>
                                                <TableCell className="text-sm text-neutral-900 dark:text-white">{describePayment(p)}</TableCell>
                                                <TableCell className="text-sm text-neutral-700 dark:text-neutral-300">{PROVIDER_NAMES[p.provider] ?? p.provider}</TableCell>
                                                <TableCell className="text-sm text-neutral-700 dark:text-neutral-300">{STATUS_LABELS[p.status] ?? p.status}</TableCell>
                                                <TableCell className="text-right text-sm tabular-nums text-neutral-900 dark:text-white">{formatMoney(p.amountMinor, p.currency)}</TableCell>
                                                <TableCell pin="end" className="text-right">
                                                    <Button asChild size="sm" variant="ghost" className="cursor-pointer rounded-xl">
                                                        <AppLink href={`/checkout/${p.id}`}>View</AppLink>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </ScrollArea>
                    )}
                </SectionPanel>
            </div>

            <CheckoutSheet
                intent={intent}
                open={sheetOpen && !!intent}
                onOpenChange={setSheetOpen}
                onExitComplete={() => setIntent(null)}
                currency={currency}
                onCurrencyChange={changeCurrency}
                providers={o.providers}
                autoRenewActive={!!(o.active && sub?.autoRenew)}
            />
        </Page>
    )
}
