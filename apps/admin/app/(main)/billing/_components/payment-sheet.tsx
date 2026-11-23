"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { AdminPaymentRow } from "@repo/billing"
import { formatMoney } from "@repo/billing/plans"
import { Button } from "@repo/ui/components/ui/button"
import { InlineLoader } from "@repo/ui/components/ui/inline-loader"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { PanelRow, PanelRows } from "@repo/ui/components/ui/section-panel"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet"
import { toast } from "@repo/ui/components/ui/toast"
import { recheckPayment } from "@/actions/billing.action"
import { formatDate, Pill } from "../../admins/_components/admin-bits"
import { BILLING_KEYS, paymentWhat, PROVIDER_NAMES, STATUS_LABELS } from "./billing-shared"
import type { GrantTarget } from "./grant-sheet"

const OUTCOME_TEXT: Record<string, string> = {
    paid: "Paid",
    pending: "Still waiting on the gateway",
    failed: "The gateway says it failed",
    cancelled: "Cancelled at the gateway",
    expired: "Expired at the gateway",
    refunded: "Refunded at the gateway",
    mismatch: "The gateway charged a different amount - nothing was applied",
}

/**
 * One payment in the keep-open sheet: every id we hold for it, and "Check with gateway", which asks the gateway
 * server to server and applies it if it is now paid (idempotent - a payment already applied changes nothing).
 */
export function PaymentSheet({ row, open, onOpenChange, onExitComplete, onGrant, recheckIcon }: {
    row: AdminPaymentRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onExitComplete: () => void
    onGrant?: (t: GrantTarget) => void
    recheckIcon: React.ReactNode
}) {
    const queryClient = useQueryClient()
    const recheck = useMutation({
        mutationFn: async (id: string) => {
            const r = await recheckPayment(id)
            if (!r.success) throw new Error(r.error ?? "The gateway could not be asked.")
            return r.data
        },
        onSuccess: async (o) => {
            toast.success(o.appliedNow ? "Paid - applied now" : OUTCOME_TEXT[o.state] ?? o.state)
            await queryClient.invalidateQueries({ queryKey: BILLING_KEYS.all })
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "The gateway could not be asked."),
    })

    return (
        <Sheet open={open} onOpenChange={onOpenChange} onExitComplete={onExitComplete}>
            <SheetContent side="right" className="flex w-full flex-col gap-4">
                <SheetHeader>
                    <SheetTitle className="truncate">{row ? `${formatMoney(row.amountMinor, row.currency)} - ${paymentWhat(row)}` : "Payment"}</SheetTitle>
                    <SheetDescription className="truncate">{row ? `${row.userName || "No name"} - ${row.userEmail ?? ""}` : null}</SheetDescription>
                </SheetHeader>
                {row ? (
                    <ScrollArea orientation="vertical" className="-mx-6 min-h-0 flex-1">
                        <div className="flex flex-col gap-4 px-6 pb-2">
                            <div className="flex flex-wrap gap-1.5">
                                <Pill>{STATUS_LABELS[row.status] ?? row.status}</Pill>
                                <Pill>{PROVIDER_NAMES[row.provider] ?? row.provider}</Pill>
                                <Pill>{row.livemode ? "Live" : "Test"}</Pill>
                            </div>
                            <PanelRows>
                                <PanelRow label="Started">{formatDate(row.createdAt, true)}</PanelRow>
                                <PanelRow label="Applied">{row.fulfilledAt ? formatDate(row.fulfilledAt, true) : "Not applied"}</PanelRow>
                                {row.failureReason ? <PanelRow label="Reason">{row.failureReason}</PanelRow> : null}
                                <PanelRow label="Our reference" valueClassName="truncate font-mono text-xs">{row.id}</PanelRow>
                                <PanelRow label="Gateway order" valueClassName="truncate font-mono text-xs">{row.providerOrderId ?? "-"}</PanelRow>
                                <PanelRow label="Gateway payment" valueClassName="truncate font-mono text-xs">{row.providerPaymentId ?? "-"}</PanelRow>
                            </PanelRows>
                        </div>
                    </ScrollArea>
                ) : null}
                {row ? (
                    <SheetFooter>
                        {onGrant && row.userId ? (
                            <Button type="button" variant="outline" className="cursor-pointer rounded-xl" data-sheet-keep-open=""
                                onClick={() => onGrant({ id: row.userId!, name: row.userName ?? "", email: row.userEmail ?? "" })}>
                                Grant credits
                            </Button>
                        ) : null}
                        {!row.fulfilledAt ? (
                            <Button type="button" className="cursor-pointer gap-2 rounded-xl" disabled={recheck.isPending} onClick={() => recheck.mutate(row.id)}>
                                {recheck.isPending ? <InlineLoader size={14} label="Checking" /> : recheckIcon}
                                Check with gateway
                            </Button>
                        ) : null}
                    </SheetFooter>
                ) : null}
            </SheetContent>
        </Sheet>
    )
}
