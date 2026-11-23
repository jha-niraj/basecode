# Payments and billing

Five gateways behind one interface, and three ways to pay - all in packages, so the app only renders pages and calls
functions. Rules that apply (AGENTS.md sections 5 and 8): money is integer minor units; a charge or credit is never in
`after()`; every write is idempotent; a return URL is never trusted - the gateway is always asked server to server.

## The pieces

| Where | What |
|---|---|
| `packages/payments/src/types.ts` | `PaymentProvider` interface, capability flags, `PaymentError` |
| `packages/payments/src/{esewa,khalti,razorpay,cashfree,stripe-provider}.ts` | One file per gateway |
| `packages/payments/src/registry.ts` | `PROVIDERS`, `getProvider(id)`, `providersFor(currency)` (only those with keys set) |
| `packages/payments/src/util.ts` | Web Crypto HMAC, constant-time compare, minor/major unit helpers |
| `packages/payments/src/store.ts` | `recordPaymentEvent` / `markPaymentEvent` (webhook events, unique per gateway event id) |
| `packages/billing/src/plans.ts` | `PLANS` (Free, Pro), `TERMS` (1 / 3 / 12 months), `CREDIT_PACKS`, prices per currency - browser-safe (`@repo/billing/plans`) |
| `packages/billing/src/ledger.ts` | Billing account, append-only credit ledger, `hasCredits`, `spendCredits`, `addCredits` |
| `packages/billing/src/checkout.ts` | `startCheckout`, `confirmPayment` (idempotent), plan periods, `cancelAutoRenew` |
| `packages/billing/src/overview.ts` | What `/settings/billing` and admin `/billing` read |
| `packages/billing/src/reminders.ts` | Daily cron job: email 3 days before a period ends, expire ended prepaid plans |
| `packages/billing/src/ai-meter.ts`, `usage-log.ts` | AI cost per call (see docs/ai.md) |

| Gateway | Currency | One-off | Auto-renew | Webhook |
|---|---|---|---|---|
| eSewa | NPR | yes | no (prepaid only) | no - verified with the status API |
| Khalti | NPR | yes | no (prepaid only) | no - verified with the lookup API (pidx) |
| Razorpay | INR | yes | yes (subscriptions) | `/api/payments/razorpay/webhook` |
| Cashfree | INR | yes | yes (subscriptions) | `/api/payments/cashfree/webhook` |
| Stripe | USD (+ `STRIPE_CURRENCIES`) | yes | yes | `/api/payments/stripe/webhook` |

The picker on `/settings/billing` shows only the gateways that take the chosen currency AND have keys set.

## What a person can buy

- **Plans** (`PLANS`): Free (a one-time grant of starter credits) and Pro. Pro is paid for 1, 3 or 12 months up front
  (prepaid, discounted for longer terms) - on any gateway - or as an auto-renewing subscription where the gateway
  supports it.
- **Credit packs** (`CREDIT_PACKS`): small / medium / large top-ups. 1 credit = $0.001 of AI cost
  (`MICRO_USD_PER_CREDIT = 1000`).
- **AI spends credits** only when `CREDITS_ENFORCED=1`: the chat route refuses a turn with a 402 (plain sentence +
  "Top up" button to `/settings/billing`) when the balance is empty, and spends the turn's metered cost inline after the
  turn, keyed on the assistant message id (once). Blank = AI is free and nothing is charged.

## Tables (`packages/db/src/schema/billing.ts`, `payments.ts`)

| Table | Holds |
|---|---|
| `billing_account` | One per owner (`owner_type` + `owner_id`; the user today, a workspace later - see docs/workspaces.md), cached `credit_balance` |
| `subscription` | One row per account: plan, status, period start/end, gateway, auto-renew |
| `payment` | Every attempt: amount (minor units), currency, gateway ids; unique on gateway + payment id and gateway + order id; `fulfilled_at` set by one conditional update, so it applies once |
| `credit_ledger` | Append-only grants / purchases / spends / refunds; unique `idempotency_key`; each insert moves the balance in the same statement |
| `payment_provider_plan` | Plan ids Razorpay needs, cached |
| `payment_event`, `payment_customer` | Raw webhook events (unique per gateway event id), gateway customer ids |
| `ai_usage_log` | Every model call and its cost (docs/ai.md) |

Created by `packages/db/scripts/billing-2026-11-23.sql` (additive, run twice) on an existing database.

## The flow

1. `/settings/billing` -> `startCheckout` writes a `payment` row (intent) and asks the gateway for a checkout.
2. The person pays on the gateway; it returns to `/api/payments/<gateway>/return/<paymentId>` (or `/cancel/...`) - one
   dispatcher route, `apps/main/app/api/payments/[provider]/[...action]/route.ts`.
3. The route asks the gateway what happened (`verifyReturn`) and calls `confirmPayment`, which applies the period or the
   credits ONCE; then it shows `/checkout/<paymentId>` (verifying / paid / failed / cancelled - it re-checks a few times
   while "verifying").
4. Webhooks (Razorpay, Cashfree, Stripe) hit the same dispatcher, are signature-checked over the raw body, stored once,
   and confirm the same way - a webhook and a return racing still credit once.

Admin `/billing` (permission `analytics`; granting credits needs `users` write) lists payments and subscriptions and
grants credits (keep-open sheet + ConfirmPopover, written to the admin audit log).

## Keys (apps/main env files - blank = that gateway is off)

| Key | Notes |
|---|---|
| `ESEWA_PRODUCT_CODE`, `ESEWA_SECRET_KEY`, `ESEWA_ENV` | Test unless `ESEWA_ENV=live` |
| `KHALTI_SECRET_KEY`, `KHALTI_ENV` | Test unless `KHALTI_ENV=live` |
| `RAZORPAY_KEY_ID` (public), `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Live when the key starts `rzp_live_` |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_ENV`, `CASHFREE_WEBHOOK_SECRET` | Test unless `CASHFREE_ENV=production`; webhook secret falls back to the secret key |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (public), `STRIPE_CURRENCIES` | Live when the key starts `sk_live_`; currencies default to USD |
| `CREDITS_ENFORCED` | `1` = AI turns need and spend credits |
| `MAIN_APP_URL` | Base of every return and webhook URL |

## Add a gateway

The top comment of `packages/payments/src/index.ts` is the checklist: a file implementing `PaymentProvider`, register it
in `registry.ts`, its keys in all three env files, and - if it sends webhooks - nothing else: the dispatcher route
already routes `/api/payments/<id>/webhook` to `handleWebhook`.

## Not verified yet (needs sandbox keys)

Written against each gateway's docs and the owner's earlier integrations, but never run against a sandbox: Cashfree
subscription charges and cancel, Razorpay subscription signature and `callback_url` redirect, where Stripe puts
subscription metadata on `invoice.paid`, and amounts to the paisa / cent on real responses. eSewa's return signature is
checked and logged; settlement relies on its status API. Test each gateway in sandbox before turning it on.
