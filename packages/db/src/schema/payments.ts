// payments tables - @repo/payments (eSewa, Khalti, Razorpay, Cashfree, Stripe). Exported from index.ts.
//
// payment_customer: one gateway customer per user and provider (created lazily at first checkout; Stripe today).
// payment_event: every verified webhook, stored ONCE - the unique (provider, event id) is the idempotency key
// (gateways retry deliveries and may send one event twice). Money is integer minor units (cents / paisa), never floats.
// payment_provider_plan: a recurring plan created AT the gateway (Razorpay needs a plan_id before a subscription), made
// once per (provider, our key) and reused - the unique index makes a double create harmless.
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './core'

export const paymentCustomer = pgTable(
    'payment_customer',
    {
        id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
        provider: text('provider').notNull().default('stripe'),
        providerCustomerId: text('provider_customer_id').notNull(),
        email: text('email'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex('payment_customer_user_provider_uq').on(t.userId, t.provider),
        uniqueIndex('payment_customer_provider_id_uq').on(t.provider, t.providerCustomerId),
    ],
)

export const PAYMENT_EVENT_STATUSES = ['received', 'processed', 'ignored', 'failed'] as const
export type PaymentEventStatus = (typeof PAYMENT_EVENT_STATUSES)[number]

export const paymentEvent = pgTable(
    'payment_event',
    {
        id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
        provider: text('provider').notNull().default('stripe'),
        /** The provider's event id (`evt_...`). Unique with provider: a redelivery inserts nothing. */
        eventId: text('event_id').notNull(),
        type: text('type').notNull(),
        /** The object the event is about (`cs_...`, `in_...`, `sub_...`). */
        objectId: text('object_id'),
        /** Our user, when the event can be tied to one (client_reference_id / metadata.userId). */
        userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
        /** Integer minor units, when the event carries an amount. */
        amountMinor: integer('amount_minor'),
        currency: text('currency'),
        status: text('status').$type<PaymentEventStatus>().notNull().default('received'),
        error: text('error'),
        livemode: boolean('livemode').notNull().default(false),
        payload: jsonb('payload').$type<unknown>().notNull(),
        receivedAt: timestamp('received_at').notNull().defaultNow(),
        processedAt: timestamp('processed_at'),
    },
    (t) => [
        uniqueIndex('payment_event_provider_event_uq').on(t.provider, t.eventId),
        index('payment_event_user_idx').on(t.userId),
        index('payment_event_type_idx').on(t.type),
        index('payment_event_received_idx').on(t.receivedAt),
    ],
)

export const paymentProviderPlan = pgTable(
    'payment_provider_plan',
    {
        id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
        provider: text('provider').notNull(),
        /** Our key for the plan: `<planCode>:<currency>:<amountMinor>:monthly`. A price change makes a new key. */
        planKey: text('plan_key').notNull(),
        providerPlanId: text('provider_plan_id').notNull(),
        livemode: boolean('livemode').notNull().default(false),
        createdAt: timestamp('created_at').notNull().defaultNow(),
    },
    (t) => [uniqueIndex('payment_provider_plan_uq').on(t.provider, t.planKey, t.livemode)],
)
