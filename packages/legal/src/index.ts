/**
 * @repo/legal - versioned legal documents (terms, privacy) as code, and acceptance records (`legal_acceptance`).
 *
 * - Documents: `getLegalDocument('terms', ctx)` returns `{ title, version, effectiveDate, markdown, template }`. The text
 *   is a TEMPLATE - replace it with reviewed terms per product and set `template: false` (documents.ts).
 * - Versions are ISO dates. Bump one only for a material change: `needsAcceptance(userId)` then lists it again for
 *   every user, and the app asks them to accept.
 * - `recordAcceptance(userId, doc, version)` accepts the CURRENT version only (throws AppError 'conflict' for a stale
 *   one); `recordCurrentAcceptances(userId)` records every current document at sign-up. Both idempotent.
 * - Client components import from `@repo/legal/documents` (pure); the root also pulls the database.
 */
export {
    LEGAL_DOCUMENT_SLUGS, listLegalDocuments, currentVersion, isLegalDocumentSlug, getLegalDocument,
    type LegalContext, type LegalDocumentSlug, type LegalDocumentMeta, type LegalDocument,
} from './documents'
export { recordAcceptance, recordCurrentAcceptances, needsAcceptance, type AcceptanceMeta } from './acceptance'
