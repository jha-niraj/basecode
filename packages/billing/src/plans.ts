// @repo/billing/plans - the price list, in CODE (not the database): a price change is a reviewed commit, never a row
// someone edited. Pure: no env, no database - the browser imports it too (`@repo/billing/plans`).
//
// Money is integer MINOR units (paisa / cents). Credits are whole numbers: 1 credit = 1000 millionths of a USD
// ($0.001) of AI cost, so a turn that cost us $0.0123 spends 13 credits (rounded UP - a real call never spends 0).

export const BILLING_CURRENCIES = ['NPR', 'INR', 'USD'] as const
export type BillingCurrency = (typeof BILLING_CURRENCIES)[number]

export function isBillingCurrency(v: unknown): v is BillingCurrency {
    return typeof v === 'string' && (BILLING_CURRENCIES as readonly string[]).includes(v)
}

export const CURRENCY_LABELS: Record<BillingCurrency, string> = {
    NPR: 'Nepali rupee (NPR)',
    INR: 'Indian rupee (INR)',
    USD: 'US dollar (USD)',
}

export type PlanCode = 'free' | 'pro'

export interface Plan {
    code: PlanCode
    name: string
    /** One line on what it is for. */
    summary: string
    /** Credits added with each paid month (Pro), or once on the first visit (Free). */
    monthlyCredits: number
    /** Price of ONE month, minor units per currency. Null = free. */
    monthlyPrice: Record<BillingCurrency, number> | null
    features: string[]
}

export const PLANS: Record<PlanCode, Plan> = {
    free: {
        code: 'free',
        name: 'Free',
        summary: 'Try everything with a starter balance of credits.',
        monthlyCredits: 500,
        monthlyPrice: null,
        features: ['500 credits to start', 'Top up credits any time'],
    },
    pro: {
        code: 'pro',
        name: 'Pro',
        summary: 'For everyday use, with credits added every month.',
        monthlyCredits: 5000,
        monthlyPrice: { NPR: 99900, INR: 49900, USD: 900 },
        features: ['5,000 credits every month', 'Top up credits any time', 'Pay for 1, 3 or 12 months, or renew automatically'],
    },
}

/** Prepaid terms. Auto-renew is always monthly. */
export const TERMS = [
    { months: 1, discountPercent: 0, label: '1 month' },
    { months: 3, discountPercent: 10, label: '3 months' },
    { months: 12, discountPercent: 20, label: '12 months' },
] as const
export type TermMonths = (typeof TERMS)[number]['months']

export function isTermMonths(v: unknown): v is TermMonths {
    return typeof v === 'number' && TERMS.some((t) => t.months === v)
}

/**
 * Price of `months` of a plan in `currency`, minor units: monthly x months, less the term's discount, rounded to a
 * whole major unit (Rs 2,697.30 -> Rs 2,697) so a price never shows odd paisa. Integer math only.
 */
export function planPrice(plan: PlanCode, currency: BillingCurrency, months: TermMonths): number | null {
    const monthly = PLANS[plan].monthlyPrice?.[currency]
    if (!monthly) return null
    const term = TERMS.find((t) => t.months === months)
    if (!term) return null
    const gross = monthly * months
    const net = Math.round((gross * (100 - term.discountPercent)) / 100)
    return Math.round(net / 100) * 100
}

export interface CreditPack {
    code: string
    credits: number
    price: Record<BillingCurrency, number>
}

export const CREDIT_PACKS: CreditPack[] = [
    { code: 'small', credits: 2000, price: { NPR: 39900, INR: 24900, USD: 300 } },
    { code: 'medium', credits: 6000, price: { NPR: 99900, INR: 64900, USD: 800 } },
    { code: 'large', credits: 15000, price: { NPR: 229900, INR: 139900, USD: 1800 } },
]

export function findPack(code: string): CreditPack | null {
    return CREDIT_PACKS.find((p) => p.code === code) ?? null
}

/** Millionths of a USD per credit. */
export const MICRO_USD_PER_CREDIT = 1000

/** Credits for an AI cost in millionths of a USD - rounded UP, so any real cost spends at least 1. */
export function creditsForMicroUsd(microUsd: number): number {
    if (!Number.isFinite(microUsd) || microUsd <= 0) return 0
    return Math.ceil(microUsd / MICRO_USD_PER_CREDIT)
}

/** Credits for a USD amount (e.g. a price card's estimate). */
export function creditsForUsd(usd: number): number {
    return creditsForMicroUsd(Math.round(usd * 1e6))
}

/** The stable key a gateway plan is created under (a price change makes a new gateway plan). */
export function recurringPlanKey(plan: PlanCode, currency: BillingCurrency, amountMinor: number): string {
    return `${plan}:${currency}:${amountMinor}:monthly`
}

/** "Rs 999", "$9", "$9.50" - currency formatting for every screen and email. */
export function formatMoney(minor: number, currency: string): string {
    const whole = minor % 100 === 0
    try {
        return new Intl.NumberFormat('en', {
            style: 'currency',
            currency,
            minimumFractionDigits: whole ? 0 : 2,
            maximumFractionDigits: 2,
        }).format(minor / 100)
    } catch {
        return `${currency} ${(minor / 100).toFixed(whole ? 0 : 2)}`
    }
}

export function formatCredits(n: number): string {
    return n.toLocaleString('en')
}
