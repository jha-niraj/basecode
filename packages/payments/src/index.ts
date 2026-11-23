/**
 * @repo/payments - five gateways behind ONE interface, Workers-safe (fetch + Web Crypto, no Node-only SDKs except
 * Stripe's fetch client): eSewa and Khalti (NPR), Razorpay and Cashfree (INR), Stripe (cards; USD by default).
 * Provider logic lives HERE, never in an app. @repo/billing decides what a payment buys; this package only talks to
 * gateways, verifies what they say, and stores webhook events once.
 *
 * The contract (types.ts, `PaymentProvider`)
 * - `createCheckout(input)` -> how the browser starts paying: a redirect, a signed form POST (eSewa), or the gateway's
 *   own script (Razorpay checkout.js, Cashfree JS SDK) - plus the gateway's order id to store.
 * - `parseReturn(params)` reads a return URL / POST into a HINT (and checks the signature where the gateway signs one).
 * - `verifyReturn(expected, hint)` asks the gateway server to server. It is the ONLY path to `state: 'paid'`; a return
 *   URL's query alone is never trusted. The caller also compares amount and currency to what it stored.
 * - `handleWebhook(request)` verifies the signature over the RAW body (constant-time compare) and maps the event to
 *   notices (payment / subscription_charge / subscription_status). eSewa and Khalti have no webhooks.
 * - `createSubscription` / `cancelSubscription` exist where `capabilities.subscriptions` is true (Stripe, Razorpay,
 *   Cashfree). eSewa / Khalti fall back to prepaid periods.
 * - `providersFor(currency)` = the providers that take that currency AND have keys set - the only ones to offer.
 * - Errors are `PaymentError` (an AppError): code not_configured / signature / gateway / unreachable / unsupported /
 *   invalid, with a sentence safe to show.
 *
 * Money is integer MINOR units everywhere (paisa / cents). A gateway that wants a decimal (Cashfree, eSewa's form)
 * is converted at its own boundary, in its own file, and nowhere else. A charge or grant runs inline (or in the
 * webhook), never in `after()`.
 *
 * Adding a provider
 * 1. `src/<name>.ts` exporting a `PaymentProvider` (copy khalti.ts for a redirect + lookup gateway, razorpay.ts for one
 *    with webhooks and subscriptions). Env read at call time via `readEnv` / `requireEnv`; test mode by default.
 * 2. Add its id to `PROVIDER_IDS` (types.ts) and to `PROVIDERS` + `ORDER` (registry.ts).
 * 3. Its return and webhook URLs are already served by the app's one dispatcher, `/api/payments/<id>/<action>`.
 * 4. List its env keys in every env file of the app (`pnpm env:check`).
 */
export * from './types'
export { PROVIDERS, getProvider, providersFor, summarize, type ProviderSummary } from './registry'
export { formatEsewaAmount, esewaState } from './esewa'
export { khaltiState } from './khalti'
export { safeEqual, hmacSha256Hex, hmacSha256Base64, minorToMajor, majorToMinor, labelOf } from './util'
// The Stripe core, kept for direct use (customer portal, custom sessions).
export {
    isStripeConfigured, isStripeWebhookConfigured, isStripeTestMode, stripePublishableKey, getStripe,
    createCheckoutSession, createPortalSession, verifyWebhook, withCheckoutSessionId, Stripe,
    type CheckoutLineItem, type CreateCheckoutSessionInput, type StripeEvent,
} from './stripe'
export {
    getOrCreateStripeCustomer, findStripeCustomer, recordStripeEvent, markStripeEvent, recordPaymentEvent, markPaymentEvent,
} from './store'
