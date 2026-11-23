// @repo/payments - the database side: Stripe customer per user, and webhook events stored once (idempotent on the
// Stripe event id). Sequential writes guarded by unique indexes (db.transaction throws on neon-http).
import { db, eq, and } from '@repo/db'
import { paymentCustomer, paymentEvent, type PaymentEventStatus } from '@repo/db/schema'
import type Stripe from 'stripe'
import { getStripe } from './stripe'

/** The user's Stripe customer id, creating the customer (and the row) on first use. Safe under a double click. */
export async function getOrCreateStripeCustomer(input: { userId: string; email: string; name?: string | null }): Promise<string> {
    const found = await db
        .select({ id: paymentCustomer.providerCustomerId })
        .from(paymentCustomer)
        .where(and(eq(paymentCustomer.userId, input.userId), eq(paymentCustomer.provider, 'stripe')))
        .limit(1)
    if (found[0]) return found[0].id

    const customer = await getStripe().customers.create(
        { email: input.email, ...(input.name ? { name: input.name } : {}), metadata: { userId: input.userId } },
        // One customer per user even when two requests race: Stripe returns the same customer for the same key.
        { idempotencyKey: `customer-${input.userId}` },
    )
    await db
        .insert(paymentCustomer)
        .values({ userId: input.userId, provider: 'stripe', providerCustomerId: customer.id, email: input.email })
        .onConflictDoNothing()
    const row = await db
        .select({ id: paymentCustomer.providerCustomerId })
        .from(paymentCustomer)
        .where(and(eq(paymentCustomer.userId, input.userId), eq(paymentCustomer.provider, 'stripe')))
        .limit(1)
    return row[0]?.id ?? customer.id
}

/** The user's Stripe customer id, or null when they never checked out. */
export async function findStripeCustomer(userId: string): Promise<string | null> {
    const rows = await db
        .select({ id: paymentCustomer.providerCustomerId })
        .from(paymentCustomer)
        .where(and(eq(paymentCustomer.userId, userId), eq(paymentCustomer.provider, 'stripe')))
        .limit(1)
    return rows[0]?.id ?? null
}

interface EventFacts {
    objectId: string | null
    userId: string | null
    amountMinor: number | null
    currency: string | null
}

function readFacts(event: Stripe.Event): EventFacts {
    const obj = event.data.object as unknown as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
    const metadata = (obj.metadata && typeof obj.metadata === 'object' ? obj.metadata : {}) as Record<string, unknown>
    const amount = [obj.amount_total, obj.amount_paid, obj.amount, obj.amount_received].find((v) => typeof v === 'number')
    return {
        objectId: str(obj.id),
        userId: str(obj.client_reference_id) ?? str(metadata.userId),
        amountMinor: typeof amount === 'number' ? amount : null,
        currency: str(obj.currency),
    }
}

/**
 * Store a verified event once. Returns `{ duplicate: true }` when this event id was already stored AND handled, so the
 * route answers 200 without handling it again. A stored event still `received` or `failed` is handed back for retry.
 */
export async function recordStripeEvent(event: Stripe.Event): Promise<{ id: string; duplicate: boolean }> {
    const facts = readFacts(event)
    const inserted = await db
        .insert(paymentEvent)
        .values({
            provider: 'stripe',
            eventId: event.id,
            type: event.type,
            objectId: facts.objectId,
            userId: null,
            amountMinor: facts.amountMinor,
            currency: facts.currency,
            livemode: event.livemode,
            payload: event,
        })
        .onConflictDoNothing()
        .returning({ id: paymentEvent.id })
    if (inserted[0]) {
        // userId is set separately: a client_reference_id that is not one of our users must not fail the insert (FK).
        if (facts.userId) {
            await db.update(paymentEvent).set({ userId: facts.userId }).where(eq(paymentEvent.id, inserted[0].id)).catch(() => undefined)
        }
        return { id: inserted[0].id, duplicate: false }
    }
    const existing = await db
        .select({ id: paymentEvent.id, status: paymentEvent.status })
        .from(paymentEvent)
        .where(and(eq(paymentEvent.provider, 'stripe'), eq(paymentEvent.eventId, event.id)))
        .limit(1)
    const row = existing[0]
    if (!row) throw new Error(`payment_event ${event.id} neither inserted nor found`)
    return { id: row.id, duplicate: row.status === 'processed' || row.status === 'ignored' }
}

/** Mark a stored event handled (processed / ignored) or failed (with the reason, so a redelivery retries it). */
export async function markStripeEvent(id: string, status: PaymentEventStatus, error?: string): Promise<void> {
    await db
        .update(paymentEvent)
        .set({ status, error: error ? error.slice(0, 1000) : null, processedAt: status === 'failed' ? null : new Date() })
        .where(eq(paymentEvent.id, id))
}

/**
 * Any provider's verified webhook, stored once (unique provider + event id). Same contract as `recordStripeEvent`:
 * `duplicate: true` = already handled (answer 200, do nothing); a `received` / `failed` row is handed back for retry.
 */
export async function recordPaymentEvent(input: {
    provider: string
    eventId: string
    type: string
    livemode: boolean
    payload: unknown
    objectId?: string | null
    amountMinor?: number | null
    currency?: string | null
}): Promise<{ id: string; duplicate: boolean }> {
    const inserted = await db
        .insert(paymentEvent)
        .values({
            provider: input.provider,
            eventId: input.eventId,
            type: input.type,
            objectId: input.objectId ?? null,
            amountMinor: input.amountMinor ?? null,
            currency: input.currency ?? null,
            livemode: input.livemode,
            payload: input.payload,
        })
        .onConflictDoNothing()
        .returning({ id: paymentEvent.id })
    if (inserted[0]) return { id: inserted[0].id, duplicate: false }
    const existing = await db
        .select({ id: paymentEvent.id, status: paymentEvent.status })
        .from(paymentEvent)
        .where(and(eq(paymentEvent.provider, input.provider), eq(paymentEvent.eventId, input.eventId)))
        .limit(1)
    const row = existing[0]
    if (!row) throw new Error(`payment_event ${input.provider}/${input.eventId} neither inserted nor found`)
    return { id: row.id, duplicate: row.status === 'processed' || row.status === 'ignored' }
}

/** Mark any stored event handled or failed (alias of markStripeEvent - the table is shared). */
export const markPaymentEvent = markStripeEvent
