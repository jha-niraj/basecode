// @repo/billing - the billing account and the credit ledger (server only).
//
// The account is per USER today (`ownerType 'user'`, `ownerId = user.id`); a workspace owner is a new ownerType, not a
// new table. The ledger is append-only; the balance is its sum, cached on billing_account and moved in the SAME SQL
// statement as the ledger insert (a CTE), so a retry (same idempotency key) inserts nothing and moves nothing.
import { and, db, desc, eq, gte, sql } from '@repo/db'
import { billingAccount, creditLedger, type BillingOwnerType, type CreditEntryKind } from '@repo/db/schema'
import { PLANS, creditsForMicroUsd } from './plans'

export type BillingAccountRow = typeof billingAccount.$inferSelect

/** The account for an owner, created on first use (safe under a race: unique owner index + re-read). New accounts get
 * the Free plan's starter credits once (`welcome:<accountId>`). */
export async function getOrCreateAccount(owner: { type: BillingOwnerType; id: string; contactUserId?: string | null }): Promise<BillingAccountRow> {
    const find = () => db.select().from(billingAccount)
        .where(and(eq(billingAccount.ownerType, owner.type), eq(billingAccount.ownerId, owner.id))).limit(1)
    const found = await find()
    if (found[0]) return found[0]
    const inserted = await db.insert(billingAccount)
        .values({ ownerType: owner.type, ownerId: owner.id, contactUserId: owner.contactUserId ?? (owner.type === 'user' ? owner.id : null) })
        .onConflictDoNothing()
        .returning()
    const row = inserted[0] ?? (await find())[0]
    if (!row) throw new Error(`billing_account for ${owner.type}/${owner.id} neither inserted nor found`)
    if (inserted[0] && PLANS.free.monthlyCredits > 0) {
        await addCredits(row.id, { kind: 'grant', amount: PLANS.free.monthlyCredits, key: `welcome:${row.id}`, description: 'Starter credits' })
        return (await find())[0] ?? row
    }
    return row
}

/** The signed-in user's own account (the only owner type in use today). */
export function accountForUser(userId: string): Promise<BillingAccountRow> {
    return getOrCreateAccount({ type: 'user', id: userId, contactUserId: userId })
}

export interface LedgerEntryInput {
    kind: CreditEntryKind
    /** Signed whole credits. */
    amount: number
    /** One real-world event = one key. A repeat inserts nothing. */
    key: string
    description?: string | null
    paymentId?: string | null
    grantedBy?: string | null
    costMicroUsd?: number | null
}

/**
 * Append a ledger row and move the cached balance in ONE statement. Returns `{ applied: false }` when the key was
 * already used (a retry, a webhook racing a return) - nothing changed. `balance` is the balance after.
 */
export async function addCredits(accountId: string, e: LedgerEntryInput): Promise<{ applied: boolean; balance: number }> {
    if (!Number.isInteger(e.amount)) throw new Error('A credit amount must be a whole number')
    const res = await db.execute(sql`
        WITH ins AS (
            INSERT INTO credit_ledger (id, account_id, kind, amount, idempotency_key, description, payment_id, granted_by, cost_micro_usd, created_at)
            VALUES (${crypto.randomUUID()}, ${accountId}, ${e.kind}, ${e.amount}, ${e.key}, ${e.description ?? null},
                    ${e.paymentId ?? null}, ${e.grantedBy ?? null}, ${e.costMicroUsd ?? null}, now())
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING amount
        )
        UPDATE billing_account
           SET credit_balance = credit_balance + (SELECT amount FROM ins), updated_at = now()
         WHERE id = ${accountId} AND EXISTS (SELECT 1 FROM ins)
        RETURNING credit_balance
    `)
    const row = res.rows[0] as { credit_balance?: number | string } | undefined
    if (row && row.credit_balance !== undefined) return { applied: true, balance: Number(row.credit_balance) }
    const [acct] = await db.select({ balance: billingAccount.creditBalance }).from(billingAccount).where(eq(billingAccount.id, accountId)).limit(1)
    return { applied: false, balance: acct?.balance ?? 0 }
}

/** Repair tool: set the cached balance to the ledger's sum (should never be needed; safe to run any time). */
export async function recomputeBalance(accountId: string): Promise<number> {
    const res = await db.execute(sql`
        UPDATE billing_account
           SET credit_balance = COALESCE((SELECT sum(amount) FROM credit_ledger WHERE account_id = ${accountId}), 0), updated_at = now()
         WHERE id = ${accountId}
        RETURNING credit_balance
    `)
    const row = res.rows[0] as { credit_balance?: number | string } | undefined
    return Number(row?.credit_balance ?? 0)
}

/** CREDITS_ENFORCED=1 (or true): an AI turn needs a positive balance and spends its cost. Blank / 0 = AI is free. */
export function creditsEnforced(): boolean {
    const v = (process.env.CREDITS_ENFORCED ?? '').trim().toLowerCase()
    return v === '1' || v === 'true'
}

/** Whether the person may start an AI turn: always true when credits are not enforced, else balance > 0. */
export async function hasCredits(userId: string): Promise<boolean> {
    if (!creditsEnforced()) return true
    const acct = await accountForUser(userId)
    return acct.creditBalance > 0
}

/**
 * Spend an AI turn's cost. `ref` names the turn (the assistant message id) - the idempotency key, so a retried write
 * never charges twice. Runs INLINE after the turn (never `after()`); the balance may go below zero by one turn's
 * cost, and the next turn is refused. Does nothing when credits are not enforced.
 */
export async function spendCredits(userId: string, amountMicroUsd: number, ref: string, description = 'AI chat turn'): Promise<{ spent: number; balance: number | null }> {
    if (!creditsEnforced()) return { spent: 0, balance: null }
    const credits = creditsForMicroUsd(amountMicroUsd)
    if (credits === 0) return { spent: 0, balance: null }
    const acct = await accountForUser(userId)
    const r = await addCredits(acct.id, { kind: 'spend', amount: -credits, key: `spend:${ref}`, description, costMicroUsd: Math.round(amountMicroUsd) })
    return { spent: r.applied ? credits : 0, balance: r.balance }
}

/** Start of the current UTC month. */
export function startOfUtcMonth(at: Date = new Date()): Date {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1))
}

/** Credits spent since the start of this UTC month (a positive number). */
export async function creditsSpentThisMonth(accountId: string): Promise<number> {
    const [row] = await db.select({ total: sql<string | null>`sum(${creditLedger.amount})` }).from(creditLedger)
        .where(and(eq(creditLedger.accountId, accountId), eq(creditLedger.kind, 'spend'), gte(creditLedger.createdAt, startOfUtcMonth())))
    return Math.abs(Number(row?.total ?? 0))
}

export type LedgerRow = typeof creditLedger.$inferSelect

export async function recentLedger(accountId: string, limit = 50): Promise<LedgerRow[]> {
    return db.select().from(creditLedger).where(eq(creditLedger.accountId, accountId)).orderBy(desc(creditLedger.createdAt)).limit(limit)
}
