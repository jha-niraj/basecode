// @repo/billing (server only) - the AI usage meter, plus plans, payments and credits.
//
// - Meter: prices each request at cache-read / cache-write / output rates and writes one `ai_usage_log` row per call;
//   a per-person daily cost cap from AI_DAILY_USD_CAP_PER_USER (blank = off).
// - Plans (code, not DB - `@repo/billing/plans`, browser-safe): Free / Pro, NPR / INR / USD, 1 / 3 / 12 months prepaid
//   with a discount, or auto-renew monthly where the gateway supports it (Stripe, Razorpay, Cashfree).
// - The billing account is per user today (ownerType/ownerId - a workspace owner drops in later). Credits are an
//   append-only ledger; the cached balance moves in the same statement as each ledger row.
// - startCheckout -> the gateway (@repo/payments) -> confirmPayment (return) / applyWebhookNotices (webhook): whichever
//   arrives first applies the purchase, the other changes nothing.
// - CREDITS_ENFORCED=1: an AI turn needs a positive balance, and spends its metered cost after the turn (inline).
export { requestCostUsd, priceCall } from './ai-meter'
export type { CallCost } from './ai-meter'
export { logAiUsage, spentTodayMicroUsd, dailyCapMicroUsd, checkDailyCap, startOfUtcDay } from './usage-log'
export * from './plans'
export {
    getOrCreateAccount, accountForUser, addCredits, recomputeBalance, creditsEnforced, hasCredits, spendCredits,
    startOfUtcMonth, creditsSpentThisMonth, recentLedger, type BillingAccountRow, type LedgerEntryInput, type LedgerRow,
} from './ledger'
export {
    appBaseUrl, startCheckout, confirmPayment, applyVerified, applyWebhookNotices, markCancelled, getPayment, effectivePlan,
    cancelAutoRenew, type CheckoutRequest, type StartCheckoutInput, type StartedCheckout, type ConfirmOutcome, type PaymentRow,
    type SubscriptionRow, type EffectivePlan,
} from './checkout'
export {
    billingOverview, setPreferredCurrency, adminListPayments, adminListSubscriptions, adminBillingStats, adminGrantCredits,
    adminUserCredits, type BillingOverview, type PaymentView, type SubscriptionView, type AdminPaymentRow, type AdminPaymentFilters,
    type AdminSubscriptionRow, type AdminBillingStats, type AdminLedgerRow, type Paged,
} from './overview'
export { sendRenewalReminders, renewalRemindersJob, renewalReminderEmail } from './reminders'
// For apps that read billing without listing @repo/payments themselves (admin).
export { isProviderId, PROVIDER_IDS, type ProviderId } from '@repo/payments'
