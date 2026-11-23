// @repo/payments - the provider list and the one question checkout asks: which providers can take this currency?
import { cashfree } from './cashfree'
import { esewa } from './esewa'
import { khalti } from './khalti'
import { razorpay } from './razorpay'
import { stripe } from './stripe-provider'
import type { Currency, PaymentProvider, ProviderId } from './types'
import { isProviderId, PaymentError } from './types'

/** Every provider, in the order the picker shows them (local wallets first for their own currency). */
export const PROVIDERS: Record<ProviderId, PaymentProvider> = { esewa, khalti, razorpay, cashfree, stripe }

const ORDER: ProviderId[] = ['esewa', 'khalti', 'razorpay', 'cashfree', 'stripe']

/** The provider for an id from a URL or a form. Throws PaymentError('invalid') for anything else. */
export function getProvider(id: string): PaymentProvider {
    if (!isProviderId(id)) throw new PaymentError('invalid', `No payment provider called "${id}".`)
    return PROVIDERS[id]
}

/**
 * The providers that take `currency` AND have their keys set - the only ones checkout may offer. With
 * `{ subscriptions: true }`, only those that can auto-renew.
 */
export function providersFor(currency: Currency, opts?: { subscriptions?: boolean }): PaymentProvider[] {
    return ORDER.map((id) => PROVIDERS[id]).filter((p) =>
        p.currencies.includes(currency) && p.isConfigured() && (!opts?.subscriptions || p.capabilities.subscriptions))
}

/** A plain summary for the browser (never a key): id, label, auto-renew support, sandbox or live. */
export interface ProviderSummary {
    id: ProviderId
    label: string
    subscriptions: boolean
    testMode: boolean
}

export function summarize(p: PaymentProvider): ProviderSummary {
    return { id: p.id, label: p.label, subscriptions: p.capabilities.subscriptions, testMode: p.mode() === 'test' }
}
