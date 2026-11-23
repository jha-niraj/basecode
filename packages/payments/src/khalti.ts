// Khalti ePayment v2 (Nepal, NPR). Initiate returns a `pidx` and a payment_url; Khalti sends the buyer back to
// return_url with pidx, status, transaction_id, amount... appended - a HINT only. There is no webhook: the lookup API
// (`POST /epayment/lookup/` with the secret key) is the truth, and only "Completed" for exactly the stored amount pays.
// Env: KHALTI_SECRET_KEY, KHALTI_ENV (`live` = khalti.com; anything else = the dev.khalti.com sandbox).
import type { CheckoutCreated, CheckoutInput, ExpectedPayment, PaymentProvider, PaymentState, ReturnHint, VerifiedPayment } from './types'
import { PaymentError } from './types'
import { emptyHint, expectOk, fetchJson, isObj, modeFromEnv, readEnv, requireEnv, str } from './util'

const mode = () => modeFromEnv('KHALTI_ENV')
const apiBase = () => (mode() === 'live' ? 'https://khalti.com/api/v2' : 'https://dev.khalti.com/api/v2')
const headers = () => ({ Authorization: `Key ${requireEnv('KHALTI_SECRET_KEY', 'khalti')}`, 'Content-Type': 'application/json' })

/** Lookup status -> PaymentState. Unknown words are pending (check again), never paid. */
export function khaltiState(status: string | null | undefined): PaymentState {
    switch (status) {
        case 'Completed': return 'paid'
        case 'User canceled': return 'cancelled'
        case 'Expired': return 'expired'
        case 'Refunded': case 'Partially Refunded': return 'refunded'
        case 'Failed': return 'failed'
        default: return 'pending'
    }
}

export const khalti: PaymentProvider = {
    id: 'khalti',
    label: 'Khalti',
    currencies: ['NPR'],
    capabilities: { subscriptions: false, webhooks: false },
    isConfigured: () => Boolean(readEnv('KHALTI_SECRET_KEY')),
    mode,

    async createCheckout(input: CheckoutInput): Promise<CheckoutCreated> {
        if (input.currency !== 'NPR') throw new PaymentError('unsupported', 'Khalti takes Nepali rupees only.', { provider: 'khalti' })
        const customer: Record<string, string> = {}
        if (input.customer.name?.trim()) customer.name = input.customer.name.trim()
        if (input.customer.email.trim()) customer.email = input.customer.email.trim()
        if (input.customer.phone?.trim()) customer.phone = input.customer.phone.trim()
        const res = await fetchJson('khalti', `${apiBase()}/epayment/initiate/`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({
                return_url: input.returnUrl,
                website_url: input.appUrl,
                amount: input.amountMinor, // paisa
                purchase_order_id: input.paymentId,
                purchase_order_name: input.description.slice(0, 100),
                ...(Object.keys(customer).length ? { customer_info: customer } : {}),
            }),
        })
        const body = expectOk('khalti', res, 'start the payment')
        const pidx = str(body.pidx)
        const url = str(body.payment_url)
        if (!pidx || !url) throw new PaymentError('gateway', 'Khalti did not return a payment page. Try again.', { provider: 'khalti' })
        return { providerOrderId: pidx, start: { type: 'redirect', url } }
    },

    async parseReturn(params): Promise<ReturnHint> {
        const hint = emptyHint()
        hint.providerOrderId = params.pidx || null
        hint.paymentId = params.purchase_order_id || null
        hint.providerPaymentId = params.transaction_id || params.tidx || null
        hint.cancelled = params.status === 'User canceled'
        return hint
    },

    async verifyReturn(expected: ExpectedPayment, hint: ReturnHint | null): Promise<VerifiedPayment> {
        // The pidx we stored at initiate - never one taken from the URL alone (it could be another order's).
        const pidx = expected.providerOrderId
        if (!pidx) throw new PaymentError('invalid', 'This payment has no Khalti reference.', { provider: 'khalti' })
        if (hint?.providerOrderId && hint.providerOrderId !== pidx) {
            throw new PaymentError('invalid', 'That Khalti return belongs to a different payment.', { provider: 'khalti' })
        }
        const res = await fetchJson('khalti', `${apiBase()}/epayment/lookup/`, { method: 'POST', headers: headers(), body: JSON.stringify({ pidx }) })
        if (res.status === 401 || res.status === 403) {
            throw new PaymentError('not_configured', 'Khalti rejected the secret key (KHALTI_SECRET_KEY / KHALTI_ENV).', { provider: 'khalti' })
        }
        const body = isObj(res.body) ? res.body : {}
        // 404 = Khalti never heard of the pidx; 5xx = could not tell. Neither is a failure of the buyer's payment.
        const status = res.status >= 200 && res.status < 300 ? str(body.status) : null
        if (str(body.pidx) && str(body.pidx) !== pidx) {
            throw new PaymentError('gateway', 'Khalti answered for a different payment.', { provider: 'khalti' })
        }
        const state = khaltiState(status)
        return {
            state,
            amountMinor: typeof body.total_amount === 'number' ? body.total_amount : null,
            currency: 'NPR',
            providerPaymentId: state === 'paid' ? (str(body.transaction_id) ?? `pidx:${pidx}`) : null,
            providerSubscriptionId: null,
            providerStatus: status ?? `http_${res.status}`,
            periodEnd: null,
            raw: res.body,
        }
    },
}
