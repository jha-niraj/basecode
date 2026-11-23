// eSewa ePay v2 (Nepal, NPR). There is no JSON "initiate" call and no webhook:
// - checkout = a set of form fields signed with HMAC-SHA256 (base64) over `total_amount,transaction_uuid,product_code`,
//   which the BROWSER posts top-level to eSewa;
// - eSewa sends the buyer to success_url with `?data=<base64 JSON>` appended (even when the URL already has a query),
//   and to failure_url with nothing - so our failure URL carries the payment id in the PATH
//   (`/api/payments/esewa/cancel/<paymentId>`);
// - the return is a hint only: the Status Check API is the sole source of truth before anything is granted.
// Env: ESEWA_PRODUCT_CODE, ESEWA_SECRET_KEY, ESEWA_ENV (`live` for real money; anything else = the rc-epay sandbox).
// Sandbox credentials are eSewa's public ones: product code EPAYTEST, secret 8gBm/:&EnhH.1/q.
import type { CheckoutCreated, CheckoutInput, ExpectedPayment, PaymentProvider, PaymentState, ReturnHint, VerifiedPayment } from './types'
import { PaymentError } from './types'
import { emptyHint, fetchJson, hmacSha256Base64, isObj, majorToMinor, modeFromEnv, readEnv, requireEnv, safeEqual, str } from './util'

const FORM_URL = { test: 'https://rc-epay.esewa.com.np/api/epay/main/v2/form', live: 'https://epay.esewa.com.np/api/epay/main/v2/form' }
const STATUS_URL = { test: 'https://rc.esewa.com.np/api/epay/transaction/status/', live: 'https://esewa.com.np/api/epay/transaction/status/' }
const SIGNED_FIELDS = 'total_amount,transaction_uuid,product_code'

/**
 * Paisa to the amount string eSewa signs: 10000 -> "100", 10050 -> "100.5", 10005 -> "100.05". The SAME string goes
 * in the form, the signature and the status check, so it is built here once.
 */
export function formatEsewaAmount(paisa: number): string {
    const p = Math.round(paisa)
    const whole = Math.trunc(p / 100)
    const frac = Math.abs(p % 100)
    if (frac === 0) return String(whole)
    return `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`
}

/** eSewa's status word -> PaymentState. No answer, PENDING, AMBIGUOUS and NOT_FOUND stay pending (NOT_FOUND is often
 * "not recorded yet" right after the redirect) - a buyer who paid is never marked failed and can be checked again. */
export function esewaState(raw: string | null | undefined): PaymentState {
    switch (raw ?? undefined) {
        case 'COMPLETE': return 'paid'
        case undefined: case 'PENDING': case 'AMBIGUOUS': case 'NOT_FOUND': return 'pending'
        case 'CANCELED': return 'cancelled'
        case 'FULL_REFUND': case 'PARTIAL_REFUND': return 'refunded'
        default: return 'failed'
    }
}

function base64ToUtf8(b64: string): string {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder('utf-8').decode(bytes)
}

/** The `data` blob eSewa appends, from a param that may also have swallowed it ("x=1?data=..."). */
function readDataBlob(params: Record<string, string>): string | null {
    if (params.data) return params.data
    for (const v of Object.values(params)) {
        const at = v.indexOf('?data=')
        if (at !== -1) return v.slice(at + 6)
    }
    return null
}

const mode = () => modeFromEnv('ESEWA_ENV')

function productCode(): string {
    return requireEnv('ESEWA_PRODUCT_CODE', 'esewa')
}

export const esewa: PaymentProvider = {
    id: 'esewa',
    label: 'eSewa',
    currencies: ['NPR'],
    capabilities: { subscriptions: false, webhooks: false },
    isConfigured: () => Boolean(readEnv('ESEWA_PRODUCT_CODE') && readEnv('ESEWA_SECRET_KEY')),
    mode,

    async createCheckout(input: CheckoutInput): Promise<CheckoutCreated> {
        if (input.currency !== 'NPR') throw new PaymentError('unsupported', 'eSewa takes Nepali rupees only.', { provider: 'esewa' })
        const secret = requireEnv('ESEWA_SECRET_KEY', 'esewa')
        const code = productCode()
        const total = formatEsewaAmount(input.amountMinor)
        const signature = await hmacSha256Base64(secret, `total_amount=${total},transaction_uuid=${input.paymentId},product_code=${code}`)
        return {
            providerOrderId: input.paymentId,
            start: {
                type: 'form',
                action: FORM_URL[mode()],
                fields: {
                    amount: total,
                    tax_amount: '0',
                    total_amount: total,
                    transaction_uuid: input.paymentId,
                    product_code: code,
                    product_service_charge: '0',
                    product_delivery_charge: '0',
                    success_url: input.returnUrl,
                    failure_url: input.cancelUrl,
                    signed_field_names: SIGNED_FIELDS,
                    signature,
                },
            },
        }
    },

    async parseReturn(params): Promise<ReturnHint> {
        const hint = emptyHint()
        const blob = readDataBlob(params)
        if (!blob) return hint
        let data: Record<string, unknown> | null = null
        try {
            // A query parser turns base64's "+" into a space; put it back before decoding.
            const parsed: unknown = JSON.parse(base64ToUtf8(blob.trim().replace(/ /g, '+')))
            data = isObj(parsed) ? parsed : null
        } catch { data = null }
        if (!data) return hint
        const d = data
        hint.paymentId = str(data.transaction_uuid)
        hint.providerOrderId = hint.paymentId
        hint.providerPaymentId = str(data.transaction_code)
        // The return is signed over its own signed_field_names. Checked and logged, but settlement rests on the
        // status API: eSewa's number formatting on the return ("100.0" vs "100") makes this flaky by design.
        const secret = readEnv('ESEWA_SECRET_KEY')
        const fields = str(data.signed_field_names)
        const sig = str(data.signature)
        if (secret && fields && sig) {
            const message = fields.split(',').map((f) => `${f}=${str(d[f]) ?? ''}`).join(',')
            hint.signatureValid = safeEqual(await hmacSha256Base64(secret, message), sig)
            if (!hint.signatureValid) console.warn('[payments:esewa] return signature did not match - relying on the status check')
        }
        return hint
    },

    async verifyReturn(expected: ExpectedPayment): Promise<VerifiedPayment> {
        const total = formatEsewaAmount(expected.amountMinor)
        const url = `${STATUS_URL[mode()]}?product_code=${encodeURIComponent(productCode())}`
            + `&total_amount=${encodeURIComponent(total)}&transaction_uuid=${encodeURIComponent(expected.paymentId)}`
        // The Status Check API is unauthenticated: no secret goes on it.
        const res = await fetchJson('esewa', url, { method: 'GET', headers: { accept: 'application/json' } })
        const body = isObj(res.body) ? res.body : {}
        const status = res.status >= 200 && res.status < 300 ? str(body.status) : null
        const state = esewaState(status)
        const refId = str(body.ref_id)
        return {
            state,
            amountMinor: majorToMinor(body.total_amount),
            currency: 'NPR',
            // ref_id is eSewa's id for the money; the uuid is ours and unique too, so a COMPLETE without ref_id still
            // has a stable key.
            providerPaymentId: state === 'paid' ? (refId ?? `uuid:${expected.paymentId}`) : null,
            providerSubscriptionId: null,
            providerStatus: status ?? `http_${res.status}`,
            periodEnd: null,
            raw: res.body,
        }
    },
}
