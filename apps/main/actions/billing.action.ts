"use server"

/**
 * The billing page's reads and writes. Every export checks the session itself and returns ActionResult. Money and
 * credits are applied INLINE (never `after()`): a checkout row is stored before the gateway is called, and a payment is
 * applied only after the gateway confirmed it server to server (@repo/billing confirmPayment).
 */
import { revalidatePath } from "next/cache"
import { requireSession } from "@repo/auth/next"
import {
    accountForUser, billingOverview, cancelAutoRenew, confirmPayment, getPayment, setPreferredCurrency, startCheckout,
    type BillingOverview, type ConfirmOutcome, type PaymentView,
} from "@repo/billing"
import { fail, failWith, ok, type ActionResult } from "@repo/errors"
import { isProviderId, type CheckoutStart } from "@repo/payments"
import { checkoutSchema, currencySchema, type CheckoutFormInput } from "@/schemas/billing"

export async function getBillingOverview(): Promise<ActionResult<BillingOverview>> {
    try {
        const session = await requireSession()
        return ok(await billingOverview(session.user.id))
    } catch (err) {
        return fail(err)
    }
}

export async function startBillingCheckout(input: CheckoutFormInput): Promise<ActionResult<{ paymentId: string; start: CheckoutStart }>> {
    try {
        const session = await requireSession()
        const parsed = checkoutSchema.safeParse(input)
        if (!parsed.success) return failWith("validation", parsed.error.issues[0]?.message ?? "Check the details.")
        const d = parsed.data
        const started = await startCheckout({
            user: { id: session.user.id, email: session.user.email, name: session.user.name },
            provider: d.provider,
            currency: d.currency,
            phone: d.phone ?? null,
            request: d.kind === "plan"
                ? { kind: "plan", plan: d.plan, months: d.months, autoRenew: d.autoRenew }
                : { kind: "credits", pack: d.pack },
        })
        await setPreferredCurrency(session.user.id, d.currency)
        return ok(started)
    } catch (err) {
        return fail(err)
    }
}

export interface PaymentResult {
    payment: PaymentView
    state: ConfirmOutcome["state"] | "unknown"
}

/** "Check again" on the result page: asks the gateway (server to server) and applies the payment if it is now paid. */
export async function checkPayment(paymentId: string): Promise<ActionResult<PaymentResult>> {
    try {
        const session = await requireSession()
        if (typeof paymentId !== "string" || !paymentId) return failWith("validation", "That payment could not be found.")
        const [row, account] = await Promise.all([getPayment(paymentId), accountForUser(session.user.id)])
        if (!row || row.accountId !== account.id || !isProviderId(row.provider)) return failWith("notfound", "That payment could not be found.")
        let state: PaymentResult["state"] = "unknown"
        if (row.fulfilledAt) state = "paid"
        else if (row.status !== "failed" && row.status !== "refunded") {
            try {
                state = (await confirmPayment(row.provider, row.id)).state
            } catch (err) {
                console.error("[billing] check payment failed", err instanceof Error ? err.message : err)
            }
        }
        const fresh = (await getPayment(row.id)) ?? row
        revalidatePath("/settings/billing")
        return ok({
            state,
            payment: {
                id: fresh.id, kind: fresh.kind, status: fresh.status, provider: fresh.provider, currency: fresh.currency,
                amountMinor: fresh.amountMinor, planCode: fresh.planCode, termMonths: fresh.termMonths, credits: fresh.credits,
                autoRenew: fresh.autoRenew, createdAt: fresh.createdAt.toISOString(),
            },
        })
    } catch (err) {
        return fail(err)
    }
}

/** Stop automatic renewal at the end of the paid period. */
export async function turnOffAutoRenew(): Promise<ActionResult<{ autoRenew: false }>> {
    try {
        const session = await requireSession({ fresh: true })
        const account = await accountForUser(session.user.id)
        const sub = await cancelAutoRenew(account.id)
        if (!sub) return failWith("notfound", "There is no plan to change.")
        revalidatePath("/settings/billing")
        return ok({ autoRenew: false })
    } catch (err) {
        return fail(err)
    }
}

export async function saveBillingCurrency(currency: string): Promise<ActionResult<{ currency: string }>> {
    try {
        const session = await requireSession()
        const parsed = currencySchema.safeParse(currency)
        if (!parsed.success) return failWith("validation", "Choose NPR, INR or USD.")
        await setPreferredCurrency(session.user.id, parsed.data)
        return ok({ currency: parsed.data })
    } catch (err) {
        return fail(err)
    }
}
