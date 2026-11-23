/**
 * @repo/erasure - delete-my-account. `eraseUser(userId)` removes the user's stored files (avatar), then their rows in
 * dependency order (AI messages, conversations, notes, notifications, acceptances, payment customer, sessions,
 * accounts, verification codes), detaches records that are kept for accounting (usage logs, payment events), deletes
 * the user, and writes an `erasure_request` row (who asked, when, status, counts; the email only as a SHA-256 hash).
 *
 * - Returns `ActionResult<{ deleted: true }>`, never throws; running it again on a gone user is a no-op success.
 * - No db.transaction (throws on neon-http): sequential, idempotent steps - a half-finished run is finished by rerunning.
 * - A new per-user table: add it to `ERASE_TABLES` (or `DETACH_TABLES` to keep it de-identified). A listed table that
 *   does not exist is skipped.
 * - Admin accounts are refused (their audit trail cascades) - remove admin access first.
 */
export { eraseUser, eraseUserAs, ERASE_TABLES, DETACH_TABLES } from './user'
