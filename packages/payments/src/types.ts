// @repo/payments - the one vocabulary every gateway maps onto. Pure types plus the typed error.
import { AppError } from '@repo/errors'

/** Currencies the product sells in. Amounts are always integer MINOR units of one of these. */
export const CURRENCIES = ['NPR', 'INR', 'USD'] as const
export type Currency = (typeof CURRENCIES)[number]

export function isCurrency(value: unknown): value is Currency {
    return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value)
}

export const PROVIDER_IDS = ['esewa', 'khalti', 'razorpay', 'cashfree', 'stripe'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export function isProviderId(value: unknown): value is ProviderId {
    return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)
}

/** 'test' = the gateway's sandbox (the default everywhere), 'live' = real money. */
export type PayMode = 'test' | 'live'

/** Where one payment stands, in one vocabulary for every provider. Only `paid` may ever grant anything. */
export type PaymentState = 'paid' | 'pending' | 'failed' | 'cancelled' | 'refunded' | 'expired'

/** Who is paying - the gateway shows or requires some of it (Cashfree requires a phone). */
export interface PaymentCustomer {
    id: string
    email: string
    name?: string | null
    phone?: string | null
}

export interface CheckoutInput {
    /** OUR payment id (payment.id). Sent as the gateway's order / transaction reference. */
    paymentId: string
    amountMinor: number
    currency: Currency
    /** One line the gateway shows ("Pro plan, 3 months"). */
    description: string
    customer: PaymentCustomer
    /** Absolute URL of this provider's return endpoint: `<app>/api/payments/<provider>/return`. */
    returnUrl: string
    /** Absolute URL the buyer lands on after cancelling: `<app>/api/payments/<provider>/cancel/<paymentId>`. */
    cancelUrl: string
    /** Absolute app origin, for gateways that want a website URL (Khalti). */
    appUrl: string
}

export interface SubscriptionInput extends CheckoutInput {
    /** Stable key of the recurring price (`pro:INR:59900:monthly`) - a gateway plan is created once per key. */
    planKey: string
    planName: string
}

/**
 * How the browser starts paying.
 * - `redirect`: send the browser to `url` (Khalti, Stripe).
 * - `form`: a top-level POST of `fields` to `action` (eSewa signs a form; no JSON initiate).
 * - `script`: the gateway's own checkout script opens with `options` (Razorpay checkout.js, Cashfree JS SDK) and
 *   sends the buyer back to our return endpoint itself.
 */
export type CheckoutStart =
    | { type: 'redirect'; url: string }
    | { type: 'form'; action: string; fields: Record<string, string> }
    | { type: 'script'; provider: 'razorpay' | 'cashfree'; src: string; options: Record<string, string | number | boolean | Record<string, string>> }

export interface CheckoutCreated {
    start: CheckoutStart
    /** The gateway's id for this checkout (pidx, cs_..., order_..., Cashfree order id). Stored on the payment row. */
    providerOrderId: string | null
    /** Set when the checkout is a subscription (Razorpay / Cashfree make it before the buyer pays). */
    providerSubscriptionId?: string | null
}

/** What a return URL (or POST) carried. A HINT only - never trusted until `verifyReturn` asked the gateway. */
export interface ReturnHint {
    paymentId: string | null
    providerOrderId: string | null
    providerPaymentId: string | null
    providerSubscriptionId: string | null
    /** The buyer came back through the cancel URL or the gateway said they cancelled. */
    cancelled: boolean
    /** For gateways that sign the return (Razorpay): whether the signature checked out. null = not signed. */
    signatureValid: boolean | null
}

/** What we stored when the checkout began - the gateway's answer must match it exactly. */
export interface ExpectedPayment {
    paymentId: string
    providerOrderId: string | null
    providerSubscriptionId: string | null
    amountMinor: number
    currency: Currency
}

/** The gateway's own answer about one payment, after mapping. */
export interface VerifiedPayment {
    state: PaymentState
    /** What the gateway says was charged, minor units; null when it did not say. */
    amountMinor: number | null
    currency: string | null
    /** The gateway's id for the money (unique per provider) once it moved. */
    providerPaymentId: string | null
    providerSubscriptionId: string | null
    /** The gateway's own status word ("COMPLETE", "Completed", "captured", "PAID", "paid"). */
    providerStatus: string
    /** End of the period this charge paid for, when a subscription gateway says so. */
    periodEnd: Date | null
    raw: unknown
}

/** One thing a verified webhook told us. */
export type WebhookNotice =
    | {
          /** A one-time payment (or a subscription's first charge) changed state. */
          kind: 'payment'
          /** Our payment id when the gateway echoes it (metadata / receipt / order_id); else match by order id. */
          paymentId: string | null
          providerOrderId: string | null
          verified: VerifiedPayment
      }
    | {
          /** An auto-renew subscription was charged (first or later cycle). */
          kind: 'subscription_charge'
          providerSubscriptionId: string
          /** Our payment id when the gateway echoes it (the first charge carries it in metadata / notes). */
          paymentId: string | null
          verified: VerifiedPayment
      }
    | {
          kind: 'subscription_status'
          providerSubscriptionId: string
          status: 'active' | 'past_due' | 'cancelled'
      }

export interface WebhookResult {
    /** Stable per real-world event (the gateway's event id, or derived from the event's facts). */
    eventId: string
    type: string
    livemode: boolean
    payload: unknown
    notices: WebhookNotice[]
}

export interface ProviderCapabilities {
    /** Can charge on its own every period (auto-renew). eSewa / Khalti cannot - they fall back to prepaid. */
    subscriptions: boolean
    /** Sends signed server-to-server notices. eSewa / Khalti have none: the return + status check is the truth. */
    webhooks: boolean
}

export interface PaymentProvider {
    id: ProviderId
    /** What the buyer reads on the picker. */
    label: string
    currencies: readonly Currency[]
    capabilities: ProviderCapabilities
    /** Every key it needs is set (never throws). */
    isConfigured(): boolean
    mode(): PayMode
    createCheckout(input: CheckoutInput): Promise<CheckoutCreated>
    /** Read the return URL / POST body. Pure apart from a signature check; trusts nothing. */
    parseReturn(params: Record<string, string>): Promise<ReturnHint>
    /** Ask the gateway, server to server, what happened to the payment we stored. The only path to `paid`. */
    verifyReturn(expected: ExpectedPayment, hint: ReturnHint | null): Promise<VerifiedPayment>
    /** Verify a webhook's signature over the RAW body and map it. Throws PaymentError('signature') on a bad one. */
    handleWebhook?(request: Request): Promise<WebhookResult>
    createSubscription?(input: SubscriptionInput): Promise<CheckoutCreated>
    /** Stop future charges. `atPeriodEnd` keeps what was paid for. */
    cancelSubscription?(providerSubscriptionId: string, opts: { atPeriodEnd: boolean }): Promise<void>
}

export type PaymentErrorCode = 'not_configured' | 'signature' | 'gateway' | 'unreachable' | 'unsupported' | 'invalid'

/**
 * A typed gateway error. `code` says what went wrong; the message is a sentence safe to show. It extends AppError, so
 * `fail(err)` in an action and `errorResponse(err)` in a route classify it without extra code.
 */
export class PaymentError extends AppError {
    readonly code: PaymentErrorCode
    readonly provider: ProviderId | null
    constructor(code: PaymentErrorCode, message: string, opts?: { provider?: ProviderId; cause?: unknown }) {
        super(
            code === 'signature' || code === 'invalid' ? 'validation'
                : code === 'unreachable' ? 'network'
                : code === 'not_configured' || code === 'unsupported' ? 'validation'
                : 'unknown',
            message,
            opts?.cause !== undefined ? { cause: opts.cause } : undefined,
        )
        this.name = 'PaymentError'
        this.code = code
        this.provider = opts?.provider ?? null
    }
}
