// Razorpay (India, INR) over fetch - the Node SDK assumes Node http, this runs on Workers.
//
// One-time: create an Order (server), open checkout.js in the browser with `callback_url` + `redirect: true`; Razorpay
// POSTs razorpay_payment_id / razorpay_order_id / razorpay_signature to our return endpoint.
//   signature = hex HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)
// Auto-renew: a Plan (made once per price, cached in payment_provider_plan) + a Subscription; checkout.js opens with
// `subscription_id` and returns razorpay_subscription_id.
//   signature = hex HMAC-SHA256(payment_id + "|" + subscription_id, RAZORPAY_KEY_SECRET)
// A valid signature is NOT enough to grant: the payment is fetched from the API and must be `captured`, for this
// order, for exactly the stored amount. Webhooks: hex HMAC-SHA256(raw body, RAZORPAY_WEBHOOK_SECRET) in
// `x-razorpay-signature`; the event id is `x-razorpay-event-id`.
// Env: RAZORPAY_KEY_ID (public - it goes to the browser in checkout options), RAZORPAY_KEY_SECRET,
// RAZORPAY_WEBHOOK_SECRET. Test vs live is decided by the key itself (rzp_test_ / rzp_live_).
import { and, db, eq } from '@repo/db'
import { paymentProviderPlan } from '@repo/db/schema'
import type {
    CheckoutCreated, CheckoutInput, ExpectedPayment, PaymentProvider, PaymentState, ReturnHint, SubscriptionInput,
    VerifiedPayment, WebhookNotice, WebhookResult,
} from './types'
import { PaymentError } from './types'
import { emptyHint, expectOk, fetchJson, hmacSha256Hex, isObj, readEnv, requireEnv, safeEqual, sha256Hex, str, type JsonResponse } from './util'

const API = 'https://api.razorpay.com/v1'
const CHECKOUT_JS = 'https://checkout.razorpay.com/v1/checkout.js'

const mode = () => (/^rzp_live_/.test(readEnv('RAZORPAY_KEY_ID') ?? '') ? 'live' as const : 'test' as const)

function auth(): Record<string, string> {
    const id = requireEnv('RAZORPAY_KEY_ID', 'razorpay')
    const secret = requireEnv('RAZORPAY_KEY_SECRET', 'razorpay')
    return { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'Content-Type': 'application/json' }
}

function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<JsonResponse> {
    return fetchJson('razorpay', `${API}${path}`, { method, headers: auth(), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
}

/** Payment entity status -> PaymentState. `authorized` is pending until captured. */
function paymentState(status: string | null): PaymentState {
    switch (status) {
        case 'captured': return 'paid'
        case 'failed': return 'failed'
        case 'refunded': return 'refunded'
        default: return 'pending' // created, authorized
    }
}

function fromPaymentEntity(p: Record<string, unknown>, extra?: { subscriptionId?: string | null; periodEnd?: Date | null }): VerifiedPayment {
    const status = str(p.status)
    return {
        state: paymentState(status),
        amountMinor: typeof p.amount === 'number' ? p.amount : null,
        currency: str(p.currency),
        providerPaymentId: str(p.id),
        providerSubscriptionId: extra?.subscriptionId ?? null,
        providerStatus: status ?? 'unknown',
        periodEnd: extra?.periodEnd ?? null,
        raw: p,
    }
}

const unixDate = (v: unknown): Date | null => (typeof v === 'number' && v > 0 ? new Date(v * 1000) : null)

function pending(status: string, raw: unknown): VerifiedPayment {
    return { state: 'pending', amountMinor: null, currency: null, providerPaymentId: null, providerSubscriptionId: null, providerStatus: status, periodEnd: null, raw }
}

/** Fetch a payment; an `authorized` one is captured for the expected amount (accounts without auto-capture). */
async function fetchPayment(paymentId: string, expected: ExpectedPayment): Promise<Record<string, unknown> | null> {
    const res = await call('GET', `/payments/${encodeURIComponent(paymentId)}`)
    if (res.status === 404) return null
    let p = expectOk('razorpay', res, 'confirm the payment')
    if (str(p.status) === 'authorized' && p.amount === expected.amountMinor) {
        const cap = await call('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: expected.amountMinor, currency: expected.currency })
        if (cap.status >= 200 && cap.status < 300 && isObj(cap.body)) p = cap.body
    }
    return p
}

/** The plan for a recurring price, created at Razorpay once and reused (unique on provider + key + mode). */
async function ensurePlan(input: SubscriptionInput): Promise<string> {
    const livemode = mode() === 'live'
    const find = () => db.select({ id: paymentProviderPlan.providerPlanId }).from(paymentProviderPlan)
        .where(and(eq(paymentProviderPlan.provider, 'razorpay'), eq(paymentProviderPlan.planKey, input.planKey), eq(paymentProviderPlan.livemode, livemode)))
        .limit(1)
    const found = await find()
    if (found[0]) return found[0].id
    const created = expectOk('razorpay', await call('POST', '/plans', {
        period: 'monthly',
        interval: 1,
        item: { name: input.planName, amount: input.amountMinor, currency: input.currency },
        notes: { planKey: input.planKey },
    }), 'set up the plan')
    const planId = str(created.id)
    if (!planId) throw new PaymentError('gateway', 'Razorpay did not return a plan.', { provider: 'razorpay' })
    await db.insert(paymentProviderPlan).values({ provider: 'razorpay', planKey: input.planKey, providerPlanId: planId, livemode }).onConflictDoNothing()
    // Two first checkouts racing may both create a plan at Razorpay; the stored one wins and the other is unused.
    return (await find())[0]?.id ?? planId
}

function checkoutOptions(input: CheckoutInput, ids: { order_id: string } | { subscription_id: string }) {
    const prefill: Record<string, string> = { email: input.customer.email }
    if (input.customer.name) prefill.name = input.customer.name
    if (input.customer.phone) prefill.contact = input.customer.phone
    return {
        key: requireEnv('RAZORPAY_KEY_ID', 'razorpay'),
        ...ids,
        amount: input.amountMinor,
        currency: input.currency,
        description: input.description.slice(0, 255),
        prefill,
        notes: { paymentId: input.paymentId },
        callback_url: input.returnUrl,
        redirect: true,
    }
}

export const razorpay: PaymentProvider = {
    id: 'razorpay',
    label: 'Razorpay (UPI, cards, netbanking)',
    currencies: ['INR'],
    capabilities: { subscriptions: true, webhooks: true },
    isConfigured: () => Boolean(readEnv('RAZORPAY_KEY_ID') && readEnv('RAZORPAY_KEY_SECRET')),
    mode,

    async createCheckout(input) {
        const order = expectOk('razorpay', await call('POST', '/orders', {
            amount: input.amountMinor,
            currency: input.currency,
            receipt: input.paymentId.slice(0, 40),
            notes: { paymentId: input.paymentId },
        }), 'start the payment')
        const orderId = str(order.id)
        if (!orderId) throw new PaymentError('gateway', 'Razorpay did not return an order.', { provider: 'razorpay' })
        return { providerOrderId: orderId, start: { type: 'script', provider: 'razorpay', src: CHECKOUT_JS, options: checkoutOptions(input, { order_id: orderId }) } }
    },

    async createSubscription(input): Promise<CheckoutCreated> {
        const planId = await ensurePlan(input)
        const sub = expectOk('razorpay', await call('POST', '/subscriptions', {
            plan_id: planId,
            // Razorpay needs a cycle count; ten years of months is "until cancelled".
            total_count: 120,
            customer_notify: 1,
            notes: { paymentId: input.paymentId, planKey: input.planKey },
        }), 'start the subscription')
        const subId = str(sub.id)
        if (!subId) throw new PaymentError('gateway', 'Razorpay did not return a subscription.', { provider: 'razorpay' })
        return {
            providerOrderId: null,
            providerSubscriptionId: subId,
            start: { type: 'script', provider: 'razorpay', src: CHECKOUT_JS, options: checkoutOptions(input, { subscription_id: subId }) },
        }
    },

    async cancelSubscription(id, { atPeriodEnd }) {
        expectOk('razorpay', await call('POST', `/subscriptions/${encodeURIComponent(id)}/cancel`, { cancel_at_cycle_end: atPeriodEnd ? 1 : 0 }), 'cancel the subscription')
    },

    async parseReturn(params): Promise<ReturnHint> {
        const hint = emptyHint()
        hint.providerPaymentId = params.razorpay_payment_id || null
        hint.providerOrderId = params.razorpay_order_id || null
        hint.providerSubscriptionId = params.razorpay_subscription_id || null
        const signature = params.razorpay_signature
        if (params['error[code]'] || params['error[description]']) {
            // A failed or cancelled checkout posts error[...] and error[metadata] = {"payment_id","order_id"}.
            try {
                const meta: unknown = JSON.parse(params['error[metadata]'] ?? '{}')
                if (isObj(meta)) {
                    hint.providerOrderId ??= str(meta.order_id)
                    hint.providerPaymentId ??= str(meta.payment_id)
                }
            } catch { /* no metadata */ }
            hint.cancelled = params['error[reason]'] === 'payment_cancelled'
            return hint
        }
        const secret = readEnv('RAZORPAY_KEY_SECRET')
        if (signature && secret && hint.providerPaymentId) {
            const message = hint.providerSubscriptionId
                ? `${hint.providerPaymentId}|${hint.providerSubscriptionId}`
                : hint.providerOrderId ? `${hint.providerOrderId}|${hint.providerPaymentId}` : null
            hint.signatureValid = message ? safeEqual(await hmacSha256Hex(secret, message), signature) : false
        }
        return hint
    },

    async verifyReturn(expected, hint) {
        if (hint?.signatureValid === false) throw new PaymentError('signature', 'The Razorpay confirmation did not check out. Nothing was added.', { provider: 'razorpay' })
        // Subscription: the payment must be captured AND the subscription must be ours.
        if (expected.providerSubscriptionId) {
            if (hint?.providerSubscriptionId && hint.providerSubscriptionId !== expected.providerSubscriptionId) {
                throw new PaymentError('invalid', 'That Razorpay return belongs to a different subscription.', { provider: 'razorpay' })
            }
            const subRes = await call('GET', `/subscriptions/${encodeURIComponent(expected.providerSubscriptionId)}`)
            const sub = expectOk('razorpay', subRes, 'confirm the subscription')
            const periodEnd = unixDate(sub.current_end)
            let paymentId = hint?.providerPaymentId ?? null
            if (!paymentId) {
                // No return (a recheck): the first paid invoice of the subscription carries the payment id.
                const inv = await call('GET', `/invoices?subscription_id=${encodeURIComponent(expected.providerSubscriptionId)}`)
                const items = isObj(inv.body) && Array.isArray(inv.body.items) ? inv.body.items.filter(isObj) : []
                paymentId = str(items.find((i) => str(i.status) === 'paid')?.payment_id)
            }
            if (!paymentId) return pending(str(sub.status) ?? 'created', sub)
            const p = await fetchPayment(paymentId, expected)
            if (!p) return pending('payment_not_found', sub)
            return fromPaymentEntity(p, { subscriptionId: expected.providerSubscriptionId, periodEnd })
        }
        // One-time: the payment must belong to OUR order.
        const orderId = expected.providerOrderId
        if (!orderId) throw new PaymentError('invalid', 'This payment has no Razorpay order.', { provider: 'razorpay' })
        if (hint?.providerOrderId && hint.providerOrderId !== orderId) {
            throw new PaymentError('invalid', 'That Razorpay return belongs to a different order.', { provider: 'razorpay' })
        }
        if (hint?.providerPaymentId) {
            const p = await fetchPayment(hint.providerPaymentId, expected)
            if (!p) return pending('payment_not_found', null)
            if (str(p.order_id) !== orderId) throw new PaymentError('invalid', 'That Razorpay payment is for a different order.', { provider: 'razorpay' })
            return fromPaymentEntity(p)
        }
        // A recheck with no return: every attempt on the order; a captured one wins, else the newest.
        const list = await call('GET', `/orders/${encodeURIComponent(orderId)}/payments`)
        const items = isObj(list.body) && Array.isArray(list.body.items) ? list.body.items.filter(isObj) : []
        const captured = items.find((i) => str(i.status) === 'captured')
        const pick = captured ?? items[0]
        return pick ? fromPaymentEntity(pick) : pending('no_attempt', list.body)
    },

    async handleWebhook(request): Promise<WebhookResult> {
        const secret = requireEnv('RAZORPAY_WEBHOOK_SECRET', 'razorpay')
        const raw = await request.text()
        const signature = request.headers.get('x-razorpay-signature') ?? ''
        if (!signature || !safeEqual(await hmacSha256Hex(secret, raw), signature)) {
            throw new PaymentError('signature', 'Invalid Razorpay signature', { provider: 'razorpay' })
        }
        let event: Record<string, unknown>
        try {
            const parsed: unknown = JSON.parse(raw)
            if (!isObj(parsed)) throw new Error('not an object')
            event = parsed
        } catch {
            throw new PaymentError('invalid', 'Razorpay sent a body that is not JSON', { provider: 'razorpay' })
        }
        const type = str(event.event) ?? 'unknown'
        const payload = isObj(event.payload) ? event.payload : {}
        const entity = (k: string) => (isObj(payload[k]) && isObj((payload[k] as Record<string, unknown>).entity) ? (payload[k] as { entity: Record<string, unknown> }).entity : null)
        const pay = entity('payment')
        const sub = entity('subscription')
        const notes = (o: Record<string, unknown> | null) => (o && isObj(o.notes) ? o.notes : {})
        const notices: WebhookNotice[] = []

        if ((type === 'payment.captured' || type === 'payment.failed' || type === 'order.paid') && pay && !str(pay.invoice_id)) {
            // Subscription payments carry an invoice_id and are handled by subscription.charged instead.
            notices.push({ kind: 'payment', paymentId: str(notes(pay).paymentId), providerOrderId: str(pay.order_id), verified: fromPaymentEntity(pay) })
        } else if (type === 'subscription.charged' && sub && pay) {
            const subId = str(sub.id)
            if (subId) notices.push({
                kind: 'subscription_charge',
                providerSubscriptionId: subId,
                paymentId: str(notes(sub).paymentId),
                verified: fromPaymentEntity(pay, { subscriptionId: subId, periodEnd: unixDate(sub.current_end) }),
            })
        } else if (sub && str(sub.id)) {
            const status = type === 'subscription.cancelled' || type === 'subscription.completed' ? 'cancelled'
                : type === 'subscription.halted' || type === 'subscription.pending' ? 'past_due'
                : type === 'subscription.activated' || type === 'subscription.resumed' ? 'active' : null
            if (status) notices.push({ kind: 'subscription_status', providerSubscriptionId: str(sub.id)!, status })
        }
        const eventId = request.headers.get('x-razorpay-event-id') ?? (await sha256Hex(`${type}|${str(pay?.id) ?? ''}|${str(sub?.id) ?? ''}|${str(pay?.status) ?? ''}`))
        return { eventId, type, livemode: mode() === 'live', payload: event, notices }
    },
}
