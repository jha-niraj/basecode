-- Billing: accounts, subscriptions, payments, credit ledger, gateway plans (@repo/billing, @repo/payments).
-- Additive and idempotent: safe to run twice. For a FRESH database `ALLOW_DB_PUSH=1 pnpm db:push` creates the same.
CREATE TABLE IF NOT EXISTS billing_account (
    id text PRIMARY KEY,
    owner_type text NOT NULL DEFAULT 'user',
    owner_id text NOT NULL,
    contact_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
    credit_balance integer NOT NULL DEFAULT 0,
    currency text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS billing_account_owner_uq ON billing_account (owner_type, owner_id);

CREATE TABLE IF NOT EXISTS subscription (
    id text PRIMARY KEY,
    account_id text NOT NULL REFERENCES billing_account(id) ON DELETE CASCADE,
    plan_code text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    provider text,
    provider_subscription_id text,
    currency text,
    amount_minor integer,
    term_months integer NOT NULL DEFAULT 1,
    current_period_start timestamp NOT NULL,
    current_period_end timestamp NOT NULL,
    auto_renew boolean NOT NULL DEFAULT false,
    reminder_sent_for timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_account_uq ON subscription (account_id);
CREATE INDEX IF NOT EXISTS subscription_period_end_idx ON subscription (current_period_end);
CREATE INDEX IF NOT EXISTS subscription_provider_sub_idx ON subscription (provider, provider_subscription_id);

CREATE TABLE IF NOT EXISTS payment (
    id text PRIMARY KEY,
    account_id text NOT NULL REFERENCES billing_account(id) ON DELETE CASCADE,
    user_id text REFERENCES "user"(id) ON DELETE SET NULL,
    kind text NOT NULL,
    status text NOT NULL DEFAULT 'created',
    provider text NOT NULL,
    currency text NOT NULL,
    amount_minor integer NOT NULL,
    plan_code text,
    term_months integer,
    auto_renew boolean NOT NULL DEFAULT false,
    pack_code text,
    credits integer,
    provider_order_id text,
    provider_payment_id text,
    provider_subscription_id text,
    fulfilled_at timestamp,
    failure_reason text,
    raw jsonb,
    livemode boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_payment_uq ON payment (provider, provider_payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_order_uq ON payment (provider, provider_order_id);
CREATE INDEX IF NOT EXISTS payment_account_created_idx ON payment (account_id, created_at);
CREATE INDEX IF NOT EXISTS payment_status_idx ON payment (status);
CREATE INDEX IF NOT EXISTS payment_provider_sub_idx ON payment (provider, provider_subscription_id);

CREATE TABLE IF NOT EXISTS credit_ledger (
    id text PRIMARY KEY,
    account_id text NOT NULL REFERENCES billing_account(id) ON DELETE CASCADE,
    kind text NOT NULL,
    amount integer NOT NULL,
    idempotency_key text NOT NULL,
    description text,
    payment_id text REFERENCES payment(id) ON DELETE SET NULL,
    granted_by text,
    cost_micro_usd integer,
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_idempotency_uq ON credit_ledger (idempotency_key);
CREATE INDEX IF NOT EXISTS credit_ledger_account_created_idx ON credit_ledger (account_id, created_at);
CREATE INDEX IF NOT EXISTS credit_ledger_kind_idx ON credit_ledger (kind);

CREATE TABLE IF NOT EXISTS payment_provider_plan (
    id text PRIMARY KEY,
    provider text NOT NULL,
    plan_key text NOT NULL,
    provider_plan_id text NOT NULL,
    livemode boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_provider_plan_uq ON payment_provider_plan (provider, plan_key, livemode);
