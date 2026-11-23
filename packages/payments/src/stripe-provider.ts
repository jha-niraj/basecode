// Stripe behind the PaymentProvider interface (cards; USD by default). Built on the Workers-safe core in stripe.ts.
// One-time: a Checkout Session (mode payment); recurring: mode subscription with an inline monthly price. Every
// session carries metadata.paymentId (ours). The success redirect is a hint - verifyReturn retrieves the session.
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (public), STRIPE_CURRENCIES
// (comma list of the currencies this Stripe account sells in; default USD).
import type Stripe from 'stripe'
import type { CheckoutCreated, CheckoutInput, Currency, PaymentProvider, PaymentState, ReturnHint, SubscriptionInput, VerifiedPayment, WebhookNotice, WebhookResult } from './types'
import { PaymentError, isCurrency } from './types'
import { getStripe, isStripeConfigured, isStripeTestMode, verifyWebhook, withCheckoutSessionId } from './stripe'
import { getOrCreateStripeCustomer } from './store'
import { emptyHint, isObj, readEnv, str } from './util'

function currencies(): Currency[] {
    const list = (readEnv('STRIPE_CURRENCIES') ?? 'USD').split(',').map((c) => c.trim().toUpperCase()).filter(isCurrency)
    return list.length ? list : ['USD']
}

const asRecord = (v: unknown): Record<string, unknown> => (isObj(v) ? v : {})
/** An expandable field: the id whether Stripe sent a string or the object. */
const idOf = (v: unknown): string | null => (typeof v === 'string' ? v : isObj(v) ? str(v.id) : null)
const unixDate = (v: unknown): Date | null => (typeof v === 'number' && v > 0 ? new Date(v * 1000) : null)

function sessionState(s: Record<string, unknown>): PaymentState {
    if (str(s.payment_status) === 'paid' || str(s.payment_status) === 'no_payment_required') return 'paid'
    if (str(s.status) === 'expired') return 'expired'
    return 'pending'
}

/** The subscription's current period end (moved onto the items in newer API versions). */
async function periodEndOf(subscriptionId: string): Promise<Date | null> {
    const sub = asRecord(await getStripe().subscriptions.retrieve(subscriptionId))
    const items = asRecord(sub.items)
    const first = Array.isArray(items.data) ? asRecord(items.data[0]) : {}
    return unixDate(first.current_period_end) ?? unixDate(sub.current_period_end)
}

/** Invoice -> its subscription id and metadata, across API versions (parent.subscription_details is the new home). */
function invoiceSubscription(inv: Record<string, unknown>): { subscriptionId: string | null; paymentId: string | null; periodEnd: Date | null } {
    const details = asRecord(asRecord(inv.parent).subscription_details)
    const legacy = asRecord(inv.subscription_details)
    const meta = asRecord(details.metadata ?? legacy.metadata)
    const lines = asRecord(inv.lines)
    const line = Array.isArray(lines.data) ? asRecord(lines.data[0]) : {}
    return {
        subscriptionId: idOf(details.subscription) ?? idOf(inv.subscription),
        paymentId: str(meta.paymentId),
        periodEnd: unixDate(asRecord(line.period).end),
    }
}

async function createSession(input: CheckoutInput, recurring: SubscriptionInput | null): Promise<CheckoutCreated> {
    if (!currencies().includes(input.currency)) {
        throw new PaymentError('unsupported', `Card payments are not set up for ${input.currency}.`, { provider: 'stripe' })
    }
    const customerId = await getOrCreateStripeCustomer({ userId: input.customer.id, email: input.customer.email, name: input.customer.name })
    const metadata = { paymentId: input.paymentId }
    const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
        currency: input.currency.toLowerCase(),
        unit_amount: input.amountMinor,
        product_data: { name: recurring?.planName ?? input.description },
        ...(recurring ? { recurring: { interval: 'month' as const } } : {}),
    }
    const session = await getStripe().checkout.sessions.create(
        {
            mode: recurring ? 'subscription' : 'payment',
            customer: customerId,
            client_reference_id: input.paymentId,
            line_items: [{ price_data: priceData, quantity: 1 }],
            success_url: withCheckoutSessionId(input.returnUrl),
            cancel_url: input.cancelUrl,
            metadata,
            ...(recurring ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
        },
        // One session per payment row even on a double click.
        { idempotencyKey: `checkout-${input.paymentId}` },
    )
    if (!session.url) throw new PaymentError('gateway', 'Stripe returned no checkout page.', { provider: 'stripe' })
    return { providerOrderId: session.id, start: { type: 'redirect', url: session.url } }
}

export const stripe: PaymentProvider = {
    id: 'stripe',
    label: 'Card (Stripe)',
    get currencies() { return currencies() },
    capabilities: { subscriptions: true, webhooks: true },
    isConfigured: isStripeConfigured,
    mode: () => (isStripeTestMode() ? 'test' : 'live'),

    createCheckout: (input) => createSession(input, null),
    createSubscription: (input) => createSession(input, input),

    async cancelSubscription(id, { atPeriodEnd }) {
        if (atPeriodEnd) await getStripe().subscriptions.update(id, { cancel_at_period_end: true })
        else await getStripe().subscriptions.cancel(id)
    },

    async parseReturn(params): Promise<ReturnHint> {
        const hint = emptyHint()
        hint.providerOrderId = params.session_id || null
        return hint
    },

    async verifyReturn(expected, hint): Promise<VerifiedPayment> {
        const sessionId = expected.providerOrderId
        if (!sessionId) throw new PaymentError('invalid', 'This payment has no Stripe session.', { provider: 'stripe' })
        if (hint?.providerOrderId && hint.providerOrderId !== sessionId) {
            throw new PaymentError('invalid', 'That Stripe return belongs to a different payment.', { provider: 'stripe' })
        }
        const s = asRecord(await getStripe().checkout.sessions.retrieve(sessionId))
        if (str(asRecord(s.metadata).paymentId) !== expected.paymentId) {
            throw new PaymentError('invalid', 'That Stripe session is for a different payment.', { provider: 'stripe' })
        }
        const state = sessionState(s)
        const subscriptionId = idOf(s.subscription)
        const isSub = str(s.mode) === 'subscription'
        return {
            state,
            amountMinor: typeof s.amount_total === 'number' ? s.amount_total : null,
            currency: str(s.currency)?.toUpperCase() ?? null,
            // A subscription's first charge is its first invoice - the same id invoice.paid reports.
            providerPaymentId: state === 'paid' ? (isSub ? idOf(s.invoice) : idOf(s.payment_intent)) ?? `session:${sessionId}` : null,
            providerSubscriptionId: subscriptionId,
            providerStatus: str(s.payment_status) ?? 'unknown',
            periodEnd: state === 'paid' && subscriptionId ? await periodEndOf(subscriptionId) : null,
            raw: s,
        }
    },

    async handleWebhook(request): Promise<WebhookResult> {
        let event: Stripe.Event
        try {
            event = await verifyWebhook(request)
        } catch (err) {
            throw new PaymentError('signature', 'Invalid Stripe signature', { provider: 'stripe', cause: err })
        }
        const obj = asRecord(event.data.object)
        const notices: WebhookNotice[] = []
        switch (event.type) {
            case 'checkout.session.completed':
            case 'checkout.session.async_payment_succeeded':
            case 'checkout.session.async_payment_failed':
            case 'checkout.session.expired': {
                // A subscription's money is reported by invoice.paid; only one-time sessions are payments here.
                if (str(obj.mode) === 'subscription') break
                const failed = event.type === 'checkout.session.async_payment_failed'
                const state: PaymentState = failed ? 'failed' : sessionState(obj)
                notices.push({
                    kind: 'payment',
                    paymentId: str(asRecord(obj.metadata).paymentId) ?? str(obj.client_reference_id),
                    providerOrderId: str(obj.id),
                    verified: {
                        state,
                        amountMinor: typeof obj.amount_total === 'number' ? obj.amount_total : null,
                        currency: str(obj.currency)?.toUpperCase() ?? null,
                        providerPaymentId: state === 'paid' ? idOf(obj.payment_intent) ?? `session:${str(obj.id)}` : null,
                        providerSubscriptionId: null,
                        providerStatus: str(obj.payment_status) ?? event.type,
                        periodEnd: null,
                        raw: obj,
                    },
                })
                break
            }
            case 'invoice.paid': {
                const sub = invoiceSubscription(obj)
                if (!sub.subscriptionId) break
                notices.push({
                    kind: 'subscription_charge',
                    providerSubscriptionId: sub.subscriptionId,
                    paymentId: str(obj.billing_reason) === 'subscription_create' ? sub.paymentId : null,
                    verified: {
                        state: 'paid',
                        amountMinor: typeof obj.amount_paid === 'number' ? obj.amount_paid : null,
                        currency: str(obj.currency)?.toUpperCase() ?? null,
                        providerPaymentId: str(obj.id),
                        providerSubscriptionId: sub.subscriptionId,
                        providerStatus: 'paid',
                        periodEnd: sub.periodEnd,
                        raw: obj,
                    },
                })
                break
            }
            case 'invoice.payment_failed': {
                const sub = invoiceSubscription(obj)
                if (sub.subscriptionId) notices.push({ kind: 'subscription_status', providerSubscriptionId: sub.subscriptionId, status: 'past_due' })
                break
            }
            case 'customer.subscription.deleted':
            case 'customer.subscription.updated': {
                const id = str(obj.id)
                const s = str(obj.status)
                const status = event.type === 'customer.subscription.deleted' || s === 'canceled' ? 'cancelled'
                    : s === 'past_due' || s === 'unpaid' ? 'past_due' : s === 'active' ? 'active' : null
                if (id && status) notices.push({ kind: 'subscription_status', providerSubscriptionId: id, status })
                break
            }
            default:
                break
        }
        return { eventId: event.id, type: event.type, livemode: event.livemode, payload: event, notices }
    },
}
