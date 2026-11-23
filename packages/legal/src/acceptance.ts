// @repo/legal - acceptance records (server only: touches the database).
import { and, db, eq, inArray } from '@repo/db'
import { legalAcceptance } from '@repo/db/schema'
import { AppError } from '@repo/errors'
import { currentVersion, LEGAL_DOCUMENT_SLUGS, type LegalDocumentSlug } from './documents'

export interface AcceptanceMeta {
    ipAddress?: string | null
    userAgent?: string | null
}

/**
 * Record that `userId` accepted `version` of `doc`. Only the CURRENT version can be accepted (an old tab cannot
 * record a stale one). Idempotent: accepting the same version twice is a no-op (unique index).
 */
export async function recordAcceptance(
    userId: string,
    doc: LegalDocumentSlug,
    version: string,
    meta: AcceptanceMeta = {},
): Promise<void> {
    if (version !== currentVersion(doc)) {
        throw new AppError('conflict', 'This document has been updated - reload the page and review the new version.')
    }
    await db
        .insert(legalAcceptance)
        .values({
            userId,
            document: doc,
            version,
            ipAddress: meta.ipAddress ?? null,
            userAgent: meta.userAgent ? meta.userAgent.slice(0, 400) : null,
        })
        .onConflictDoNothing()
}

/** Record acceptance of the current version of several documents at once (sign-up: terms + privacy). */
export async function recordCurrentAcceptances(
    userId: string,
    docs: readonly LegalDocumentSlug[] = LEGAL_DOCUMENT_SLUGS,
    meta: AcceptanceMeta = {},
): Promise<void> {
    if (docs.length === 0) return
    await db
        .insert(legalAcceptance)
        .values(docs.map((doc) => ({
            userId,
            document: doc,
            version: currentVersion(doc),
            ipAddress: meta.ipAddress ?? null,
            userAgent: meta.userAgent ? meta.userAgent.slice(0, 400) : null,
        })))
        .onConflictDoNothing()
}

/**
 * The documents whose CURRENT version `userId` has not accepted yet - empty means nothing to ask. A version bump in
 * documents.ts makes every user show up here again.
 */
export async function needsAcceptance(
    userId: string,
    docs: readonly LegalDocumentSlug[] = LEGAL_DOCUMENT_SLUGS,
): Promise<LegalDocumentSlug[]> {
    if (docs.length === 0) return []
    const rows = await db
        .select({ document: legalAcceptance.document, version: legalAcceptance.version })
        .from(legalAcceptance)
        .where(and(eq(legalAcceptance.userId, userId), inArray(legalAcceptance.document, [...docs])))
    const have = new Set(rows.map((r) => `${r.document}@${r.version}`))
    return docs.filter((d) => !have.has(`${d}@${currentVersion(d)}`))
}
