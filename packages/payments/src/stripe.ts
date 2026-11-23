// @repo/payments - Stripe over the SDK's FETCH client (no Node http) and SubtleCrypto webhook verification, so it runs
// on Cloudflare Workers. Keys are read at call time; nothing throws at import.
import Stripe from 'stripe'
import { AppError } from '@repo/errors'

function readEnv(name: string): string | undefined {
    const v = process.env[name]?.trim()
    return v ? v : undefined
}

/** True when STRIPE_SECRET_KEY is set. Server-only; pass the boolean down to client UI. */
export function isStripeConfigured(): boolean {
    return Boolean(readEnv('STRIPE_SECRET_KEY'))
}

/** True when STRIPE_WEBHOOK_SECRET is set too (the webhook route can verify). */
export function isStripeWebhookConfigured(): boolean {
    return isStripeConfigured() && Boolean(readEnv('STRIPE_WEBHOOK_SECRET'))
}

/** The publishable key for the browser (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY), or null. */
export function stripePublishableKey(): string | null {
    return readEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY') ?? null
}

/** True for a test-mode secret key (sk_test_ / rk_test_). */
export function isStripeTestMode(): boolean {
    return /^(sk|rk)_test_/.test(readEnv('STRIPE_SECRET_KEY') ?? '')
}

let cached: { key: string; client: Stripe } | null = null

/** The Stripe client (fetch transport). Throws naming STRIPE_SECRET_KEY when it is missing. API version = the SDK's pin. */
export function getStripe(): Stripe {
    const key = readEnv('STRIPE_SECRET_KEY')
    if (!key) throw new AppError('unknown', 'STRIPE_SECRET_KEY is not set')
    if (cached?.key !== key) {
        cached = { key, client: new Stripe(key, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2 }) }
    }
    return cached.client
}

let cryptoProvider: ReturnType<typeof Stripe.createSubtleCryptoProvider> | null = null

/** A line item: a Price you created in Stripe, or an ad-hoc amount in integer MINOR units (cents / paisa). */
export type CheckoutLineItem =
    | { priceId: string; quantity?: number }
    | { name: string; amountMinor: number; currency: string; quantity?: number; description?: string }

export interface CreateCheckoutSessionInput {
    mode: 'payment' | 'subscription'
    lineItems: CheckoutLineItem[]
    /** Where Stripe sends the buyer after paying; `{CHECKOUT_SESSION_ID}` is appended as `session_id`. */
    successUrl: string
    cancelUrl: string
    /** An existing Stripe customer (see `getOrCreateStripeCustomer`); else `customerEmail` prefills the form. */
    customerId?: string
    customerEmail?: string
    /** Our id for this purchase (usually the user id); comes back on the webhook. */
    clientReferenceId?: string
    metadata?: Record<string, string>
    allowPromotionCodes?: boolean
    /** Idempotency key for the create call - pass one per purchase attempt so a double click makes one session. */
    idempotencyKey?: string
}

/** `success_url` must carry the literal `{CHECKOUT_SESSION_ID}`, so it is appended unencoded. */
export function withCheckoutSessionId(url: string): string {
    return `${url}${url.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`
}

function toStripeLineItem(item: CheckoutLineItem): Stripe.Checkout.SessionCreateParams.LineItem {
    const quantity = item.quantity ?? 1
    if (!Number.isInteger(quantity) || quantity < 1) throw new AppError('validation', 'Quantity must be a whole number of at least 1.')
    if ('priceId' in item) return { price: item.priceId, quantity }
    if (!Number.isInteger(item.amountMinor) || item.amountMinor <= 0) {
        throw new AppError('validation', 'An amount must be a positive whole number of minor units (cents).')
    }
    return {
        quantity,
        price_data: {
            currency: item.currency.toLowerCase(),
            unit_amount: item.amountMinor,
            product_data: { name: item.name, ...(item.description ? { description: item.description } : {}) },
        },
    }
}

/** Create a hosted Checkout page. Redirect the browser to `url`; fulfil ONLY from the verified webhook, never here. */
export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<{ id: string; url: string }> {
    if (input.lineItems.length === 0) throw new AppError('validation', 'Nothing to pay for.')
    const params: Stripe.Checkout.SessionCreateParams = {
        mode: input.mode,
        line_items: input.lineItems.map(toStripeLineItem),
        success_url: withCheckoutSessionId(input.successUrl),
        cancel_url: input.cancelUrl,
        ...(input.customerId ? { customer: input.customerId } : input.customerEmail ? { customer_email: input.customerEmail } : {}),
        ...(input.clientReferenceId ? { client_reference_id: input.clientReferenceId } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
        ...(input.allowPromotionCodes ? { allow_promotion_codes: true } : {}),
    }
    const session = await getStripe().checkout.sessions.create(
        params,
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    )
    if (!session.url) throw new AppError('network', 'Stripe returned no checkout page.')
    return { id: session.id, url: session.url }
}

/** The customer portal (manage cards, invoices, subscriptions). Redirect the browser to `url`. */
export async function createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    const session = await getStripe().billingPortal.sessions.create({ customer: input.customerId, return_url: input.returnUrl })
    return { url: session.url }
}

/**
 * Verify a webhook request and return the event. Reads the RAW body (never JSON-parse first - the signature is over
 * the exact bytes) and checks `stripe-signature` with STRIPE_WEBHOOK_SECRET via SubtleCrypto (5-minute tolerance).
 * Throws AppError 'validation' on a missing or bad signature - answer 400 so Stripe shows it as failed.
 */
export async function verifyWebhook(request: Request): Promise<Stripe.Event> {
    const secret = readEnv('STRIPE_WEBHOOK_SECRET')
    if (!secret) throw new AppError('unknown', 'STRIPE_WEBHOOK_SECRET is not set')
    const signature = request.headers.get('stripe-signature')
    if (!signature) throw new AppError('validation', 'Missing stripe-signature header')
    const body = await request.text()
    try {
        return await getStripe().webhooks.constructEventAsync(body, signature, secret, undefined, (cryptoProvider ??= Stripe.createSubtleCryptoProvider()))
    } catch (err) {
        throw new AppError('validation', 'Invalid Stripe signature', { cause: err })
    }
}

export type StripeEvent = Stripe.Event
export { Stripe }
