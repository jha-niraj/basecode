import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { accountForUser, getPayment } from "@repo/billing"
import { getSession } from "@/lib/session"
import { CheckoutResult } from "./_components/checkout-result"

export const metadata: Metadata = { title: "Payment" }

type Params = Promise<{ paymentId: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * Where every gateway's return lands (via /api/payments/<provider>/return/<id>, which already asked the gateway).
 * Shows the payment as stored; while it is still open the client asks again (server to server) a few times.
 * Only the payment's own account may see it.
 */
export default async function CheckoutResultPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
    const { paymentId } = await params
    const session = await getSession()
    if (!session) redirect(`/signin?stale=1&returnTo=/checkout/${encodeURIComponent(paymentId)}`)
    const [row, account] = await Promise.all([getPayment(paymentId), accountForUser(session.user.id)])
    if (!row || row.accountId !== account.id) notFound()
    const sp = await searchParams
    const verify = typeof sp.verify === "string" ? sp.verify : null
    return (
        <CheckoutResult
            initial={{
                id: row.id, kind: row.kind, status: row.status, provider: row.provider, currency: row.currency,
                amountMinor: row.amountMinor, planCode: row.planCode, termMonths: row.termMonths, credits: row.credits,
                autoRenew: row.autoRenew, createdAt: row.createdAt.toISOString(),
            }}
            mismatch={row.status === "failed" && (row.failureReason ?? "").startsWith("amount_mismatch")}
            verifyNote={verify === "signature" ? "signature" : verify ? "later" : null}
        />
    )
}
