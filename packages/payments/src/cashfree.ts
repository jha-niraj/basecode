// Cashfree PG (India, INR) over fetch (the SDK assumes Node), API version pinned - payloads differ between versions.
//
// One-time: POST /pg/orders with order_id = OUR payment id -> payment_session_id; the browser opens the Cashfree JS SDK
// (`cashfree.checkout({ paymentSessionId, redirectTarget: '_self' })`) and Cashfree sends it back to
// `return_url?order_id=<id>`. The return proves nothing: GET /pg/orders/{id} must say PAID for the stored amount.
// Auto-renew: POST /pg/subscriptions with subscription_id = OUR payment id and a PERIODIC monthly plan; the mandate's
// authorization charge IS the first month (authorization_amount = the price, not refunded), so the first period is paid
// at sign-up and Cashfree raises the next charge a month later. SDK: `cashfree.subscriptionsCheckout({ subsSessionId })`.
// Webhooks: base64 HMAC-SHA256(x-webhook-timestamp + raw body) with the client secret (or CASHFREE_WEBHOOK_SECRET).
// Payment webhooks carry no event id, so one is derived from the event's FACTS (a retry repeats them exactly).
// Env: CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV (`production` for real money; else the sandbox),
// CASHFREE_WEBHOOK_SECRET (optional; defaults to the secret key, which is what Cashfree signs with).
import type {
    CheckoutCreated, ExpectedPayment, PaymentProvider, PaymentState, ReturnHint, SubscriptionInput, VerifiedPayment,
    WebhookNotice, WebhookResult,
} from './types'
import { PaymentError } from './types'
import {
    emptyHint, expectOk, fetchJson, hmacSha256Base64, isObj, majorToMinor, minorToMajor, modeFromEnv, readEnv, requireEnv,
    safeEqual, sha256Hex, str, withQuery, type JsonResponse,
} from './util'

const API_VERSION = '2025-01-01'
const SDK_SRC = 'https://sdk.cashfree.com/js/v3/cashfree.js'
const mode = () => modeFromEnv('CASHFREE_ENV')
const base = () => (mode() === 'live' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg')

function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<JsonResponse> {
    return fetchJson('cashfree', `${base()}${path}`, {
        method,
        headers: {
            'x-client-id': requireEnv('CASHFREE_APP_ID', 'cashfree'),
            'x-client-secret': requireEnv('CASHFREE_SECRET_KEY', 'cashfree'),
            'x-api-version': API_VERSION,
            'Content-Type': 'application/json',
            accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
}

/** Cashfree wants a 10-digit phone. The app does not collect one at sign-up, so the checkout asks for it. */
function phoneOf(phone: string | null | undefined): string {
    const digits = (phone ?? '').replace(/\D/g, '').slice(-10)
    if (digits.length !== 10) throw new PaymentError('invalid', 'Enter a 10-digit mobile number to pay with Cashfree.', { provider: 'cashfree' })
    return digits
}

/** A Cashfree id: letters, digits, - and _ only (our ids are UUIDs - already fine). */
const cfId = (id: string) => id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50)

function attemptState(status: string | null): PaymentState {
    switch ((status ?? '').toUpperCase()) {
        case 'SUCCESS': return 'paid'
        case 'FAILED': return 'failed'
        case 'USER_DROPPED': case 'CANCELLED': case 'VOID': return 'cancelled'
        default: return 'pending'
    }
}

function attempt(p: Record<string, unknown>, subscriptionId: string | null): VerifiedPayment {
    const status = str(p.payment_status)
    return {
        state: attemptState(status),
        amountMinor: majorToMinor(p.payment_amount),
        currency: str(p.payment_currency),
        providerPaymentId: str(p.cf_payment_id),
        providerSubscriptionId: subscriptionId,
        providerStatus: status ?? 'unknown',
        periodEnd: null,
        raw: p,
    }
}

function pending(status: string, raw: unknown): VerifiedPayment {
    return { state: 'pending', amountMinor: null, currency: null, providerPaymentId: null, providerSubscriptionId: null, providerStatus: status, periodEnd: null, raw }
}

const listOf = (body: unknown): Record<string, unknown>[] => (Array.isArray(body) ? body.filter(isObj) : isObj(body) && Array.isArray(body.data) ? body.data.filter(isObj) : [])

function sdkMode(): string {
    return mode() === 'live' ? 'production' : 'sandbox'
}

export const cashfree: PaymentProvider = {
    id: 'cashfree',
    label: 'Cashfree (UPI, cards, netbanking)',
    currencies: ['INR'],
    capabilities: { subscriptions: true, webhooks: true },
    isConfigured: () => Boolean(readEnv('CASHFREE_APP_ID') && readEnv('CASHFREE_SECRET_KEY')),
    mode,

    async createCheckout(input) {
        const orderId = cfId(input.paymentId)
        const order = expectOk('cashfree', await call('POST', '/orders', {
            order_id: orderId,
            // Cashfree takes a DECIMAL in the order currency; converted at this boundary only.
            order_amount: minorToMajor(input.amountMinor),
            order_currency: input.currency,
            customer_details: {
                customer_id: cfId(input.customer.id),
                customer_email: input.customer.email,
                customer_phone: phoneOf(input.customer.phone),
                ...(input.customer.name ? { customer_name: input.customer.name } : {}),
            },
            // {order_id} is replaced by Cashfree.
            order_meta: { return_url: withQuery(input.returnUrl, { order_id: '{order_id}' }).replace('%7Border_id%7D', '{order_id}') },
            order_note: input.description.slice(0, 200),
        }), 'start the payment')
        const session = str(order.payment_session_id)
        if (!session) throw new PaymentError('gateway', 'Cashfree did not return a payment session.', { provider: 'cashfree' })
        return { providerOrderId: orderId, start: { type: 'script', provider: 'cashfree', src: SDK_SRC, options: { mode: sdkMode(), paymentSessionId: session } } }
    },

    async createSubscription(input: SubscriptionInput): Promise<CheckoutCreated> {
        const subId = cfId(input.paymentId)
        const amount = minorToMajor(input.amountMinor)
        const sub = expectOk('cashfree', await call('POST', '/subscriptions', {
            subscription_id: subId,
            customer_details: {
                customer_name: input.customer.name || input.customer.email,
                customer_email: input.customer.email,
                customer_phone: phoneOf(input.customer.phone),
            },
            plan_details: {
                plan_name: input.planName.slice(0, 40),
                plan_type: 'PERIODIC',
                plan_amount: amount,
                plan_max_amount: amount,
                plan_max_cycles: 120,
                plan_intervals: 1,
                plan_currency: input.currency,
                plan_interval_type: 'MONTH',
                plan_note: input.planKey,
            },
            // The authorization charge is the first month, kept (not refunded).
            authorization_details: { authorization_amount: amount, authorization_amount_refund: false, payment_methods: ['upi', 'card', 'enach'] },
            subscription_meta: { return_url: withQuery(input.returnUrl, { subscription_id: subId }) },
            subscription_first_charge_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            subscription_tags: { paymentId: input.paymentId },
        }), 'start the subscription')
        const session = str(sub.subscription_session_id)
        if (!session) throw new PaymentError('gateway', 'Cashfree did not return a subscription session.', { provider: 'cashfree' })
        return {
            providerOrderId: null,
            providerSubscriptionId: subId,
            start: { type: 'script', provider: 'cashfree', src: SDK_SRC, options: { mode: sdkMode(), subsSessionId: session } },
        }
    },

    async cancelSubscription(id) {
        // Cashfree has no "at period end": a cancel stops future charges; what was paid stays paid on our side.
        expectOk('cashfree', await call('POST', `/subscriptions/${encodeURIComponent(id)}/manage`, { subscription_id: id, action: 'CANCEL' }), 'cancel the subscription')
    },

    async parseReturn(params): Promise<ReturnHint> {
        const hint = emptyHint()
        hint.providerOrderId = params.order_id || null
        hint.providerSubscriptionId = params.subscription_id || null
        hint.paymentId = hint.providerOrderId ?? hint.providerSubscriptionId
        return hint
    },

    async verifyReturn(expected: ExpectedPayment, hint): Promise<VerifiedPayment> {
        if (expected.providerSubscriptionId) {
            const id = expected.providerSubscriptionId
            if (hint?.providerSubscriptionId && hint.providerSubscriptionId !== id) {
                throw new PaymentError('invalid', 'That Cashfree return belongs to a different subscription.', { provider: 'cashfree' })
            }
            const sub = expectOk('cashfree', await call('GET', `/subscriptions/${encodeURIComponent(id)}`), 'confirm the subscription')
            const payments = listOf((await call('GET', `/subscriptions/${encodeURIComponent(id)}/payments`)).body)
            const paid = payments.find((p) => attemptState(str(p.payment_status)) === 'paid')
            if (paid) return attempt(paid, id)
            const status = (str(sub.subscription_status) ?? '').toUpperCase()
            if (['CANCELLED', 'CUSTOMER_CANCELLED', 'LINK_EXPIRED', 'EXPIRED'].includes(status)) {
                return { ...pending(status, sub), state: status.includes('EXPIRED') ? 'expired' : 'cancelled' }
            }
            const latest = payments[0]
            return latest && attemptState(str(latest.payment_status)) === 'failed' ? attempt(latest, id) : pending(status || 'INITIALIZED', sub)
        }
        const orderId = expected.providerOrderId
        if (!orderId) throw new PaymentError('invalid', 'This payment has no Cashfree order.', { provider: 'cashfree' })
        if (hint?.providerOrderId && hint.providerOrderId !== orderId) {
            throw new PaymentError('invalid', 'That Cashfree return belongs to a different order.', { provider: 'cashfree' })
        }
        const order = expectOk('cashfree', await call('GET', `/orders/${encodeURIComponent(orderId)}`), 'confirm the payment')
        const status = (str(order.order_status) ?? '').toUpperCase()
        const payments = listOf((await call('GET', `/orders/${encodeURIComponent(orderId)}/payments`)).body)
        if (status === 'PAID') {
            const ok = payments.find((p) => attemptState(str(p.payment_status)) === 'paid')
            return {
                state: 'paid',
                amountMinor: majorToMinor(order.order_amount),
                currency: str(order.order_currency),
                providerPaymentId: str(ok?.cf_payment_id) ?? `order:${orderId}`,
                providerSubscriptionId: null,
                providerStatus: status,
                periodEnd: null,
                raw: { order, payments },
            }
        }
        if (status === 'EXPIRED') return { ...pending(status, order), state: 'expired' }
        if (status === 'TERMINATED') return { ...pending(status, order), state: 'cancelled' }
        // ACTIVE = still payable. The newest attempt says whether the buyer gave up or it failed.
        const latest = payments[0]
        return latest ? { ...attempt(latest, null), providerPaymentId: null, amountMinor: null } : pending(status || 'ACTIVE', order)
    },

    async handleWebhook(request): Promise<WebhookResult> {
        const secret = readEnv('CASHFREE_WEBHOOK_SECRET') ?? requireEnv('CASHFREE_SECRET_KEY', 'cashfree')
        const raw = await request.text()
        const signature = request.headers.get('x-webhook-signature')
        const timestamp = request.headers.get('x-webhook-timestamp')
        if (!signature || !timestamp || !safeEqual(await hmacSha256Base64(secret, timestamp + raw), signature)) {
            throw new PaymentError('signature', 'Invalid Cashfree signature', { provider: 'cashfree' })
        }
        let event: Record<string, unknown>
        try {
            const parsed: unknown = JSON.parse(raw)
            if (!isObj(parsed)) throw new Error('not an object')
            event = parsed
        } catch {
            throw new PaymentError('invalid', 'Cashfree sent a body that is not JSON', { provider: 'cashfree' })
        }
        const type = str(event.type) ?? 'unknown'
        const data = isObj(event.data) ? event.data : {}
        const notices: WebhookNotice[] = []
        let facts = `${type}|${raw}`

        if (type.startsWith('PAYMENT_') && isObj(data.order) && isObj(data.payment)) {
            const orderId = str(data.order.order_id)
            notices.push({ kind: 'payment', paymentId: orderId, providerOrderId: orderId, verified: attempt(data.payment, null) })
            facts = `payment|${orderId}|${str(data.payment.cf_payment_id)}|${str(data.payment.payment_status)}`
        } else if (type === 'SUBSCRIPTION_AUTH_STATUS' || type === 'SUBSCRIPTION_PAYMENT_SUCCESS' || type === 'SUBSCRIPTION_PAYMENT_FAILED') {
            const subId = str(data.subscription_id)
            if (subId) {
                const v = attempt(data, subId)
                // The authorization charge was the first month: our payment id is the subscription id.
                notices.push({ kind: 'subscription_charge', providerSubscriptionId: subId, paymentId: type === 'SUBSCRIPTION_AUTH_STATUS' ? subId : null, verified: v })
                facts = `sub-payment|${subId}|${str(data.cf_payment_id)}|${str(data.payment_status)}`
            }
        } else if (type === 'SUBSCRIPTION_STATUS_CHANGED' && isObj(data.subscription_details)) {
            const subId = str(data.subscription_details.subscription_id)
            const s = (str(data.subscription_details.subscription_status) ?? '').toUpperCase()
            const status = s === 'ACTIVE' ? 'active' : s === 'ON_HOLD' || s === 'CARD_EXPIRED' ? 'past_due'
                : ['CANCELLED', 'CUSTOMER_CANCELLED', 'COMPLETED', 'EXPIRED'].includes(s) ? 'cancelled' : null
            if (subId && status) notices.push({ kind: 'subscription_status', providerSubscriptionId: subId, status })
            facts = `sub-status|${subId}|${s}`
        }
        return { eventId: await sha256Hex(facts), type, livemode: mode() === 'live', payload: event, notices }
    },
}
