"use client"

import { BILLING_CURRENCIES, CURRENCY_LABELS, type BillingCurrency } from "@repo/billing/plans"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select"
import { cn } from "@repo/ui/lib/utils"

/** The currency the prices are shown and paid in. The checkout offers only the providers that take it. */
export function CurrencySelect({ value, onChange, className }: { value: BillingCurrency; onChange: (c: BillingCurrency) => void; className?: string }) {
    return (
        <Select value={value} onValueChange={(v) => onChange(v as BillingCurrency)}>
            <SelectTrigger size="sm" aria-label="Currency" className={cn("w-40 cursor-pointer rounded-xl", className)}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent emptyMessage="No currencies">
                {BILLING_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}
