/**
 * Real sentences for auth failures - never "Something went wrong". IMPORT-FREE (client and server).
 *
 * `authErrorMessage(code)` covers better-auth's API codes (`error.code` on a client call) and the OAuth redirect codes
 * (`?error=` on the sign-in page after Google). An unknown code gets its own text back when it is readable.
 */

const MESSAGES: Record<string, string> = {
    // Email + password
    INVALID_EMAIL_OR_PASSWORD: 'That email and password do not match. Check both, or reset your password.',
    INVALID_PASSWORD: 'That password is not right.',
    INVALID_EMAIL: 'That does not look like an email address.',
    EMAIL_NOT_VERIFIED: 'Confirm your email first - we just sent you a new link.',
    USER_ALREADY_EXISTS: 'An account with this email already exists. Sign in instead.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with this email already exists. Sign in instead.',
    PASSWORD_TOO_SHORT: 'Use at least 8 characters for the password.',
    PASSWORD_TOO_LONG: 'That password is too long - keep it under 128 characters.',
    CREDENTIAL_ACCOUNT_NOT_FOUND: 'This account has no password yet. Sign in with Google or an email code, then set one in your profile.',
    PASSWORD_ALREADY_SET: 'This account already has a password. Change it instead.',
    USER_ALREADY_HAS_PASSWORD: 'This account already has a password. Change it instead.',
    USER_NOT_FOUND: 'There is no account with that email.',
    INVALID_TOKEN: 'That link is no longer valid. Ask for a new one.',
    TOKEN_EXPIRED: 'That link has expired. Ask for a new one.',
    SESSION_EXPIRED: 'For your safety, sign in again before doing that.',
    SESSION_NOT_FRESH: 'For your safety, sign in again before doing that.',
    FAILED_TO_CREATE_SESSION: 'This account cannot sign in right now. Contact support if this keeps happening.',
    EMAIL_ALREADY_VERIFIED: 'This email is already confirmed. You can sign in.',
    // Email code
    INVALID_OTP: 'That code is not right. Check the latest email and try again.',
    OTP_EXPIRED: 'That code has expired. Send a new one.',
    TOO_MANY_ATTEMPTS: 'Too many wrong codes. Send a new one.',
    // OAuth redirect codes (`?error=` after Google)
    access_denied: 'Google sign-in was cancelled.',
    account_not_linked: 'This email already has an account that is not linked to Google. Sign in with your password or an email code.',
    unable_to_link_account: 'We could not link your Google account. Sign in with your password or an email code.',
    signup_disabled: 'There is no account for that Google address yet. Create one first.',
    email_not_found: 'Google did not share an email address. Allow email access and try again.',
    "email_doesn't_match": 'That Google account uses a different email.',
    state_mismatch: 'The sign-in took too long or was opened in another tab. Start again.',
    please_restart_the_process: 'The sign-in took too long or was opened in another tab. Start again.',
    invalid_code: 'Google sign-in did not finish. Start again.',
    no_code: 'Google sign-in did not finish. Start again.',
    unable_to_get_user_info: 'Google did not answer in time. Try again.',
    oauth_provider_not_found: 'Google sign-in is not set up for this app.',
    invalid_callback_request: 'Google sign-in did not finish. Start again.',
    internal_server_error: 'Sign-in failed on our side. Try again in a minute.',
}

/** Status-based fallbacks when no code is known. */
function byStatus(status: number | undefined): string | null {
    if (status === 429) return 'Too many attempts. Wait a minute and try again.'
    if (status === 403) return 'That is not allowed for this account.'
    if (status && status >= 500) return 'Sign-in failed on our side. Try again in a minute.'
    return null
}

export function authErrorMessage(code: string | null | undefined, opts?: { status?: number; message?: string }): string {
    if (code && MESSAGES[code]) return MESSAGES[code]
    if (code && MESSAGES[code.toUpperCase()]) return MESSAGES[code.toUpperCase()]!
    const s = byStatus(opts?.status)
    if (s) return s
    const m = opts?.message?.trim()
    if (m && m.length < 160 && !/[{}<>]|Error:|at \w+/.test(m)) return m.endsWith('.') ? m : `${m}.`
    return 'That did not work. Check your connection and try again.'
}

/** A better-auth client error (`{ code?, message?, status? }`) as one sentence. */
export function clientErrorMessage(error: { code?: string; message?: string; status?: number } | null | undefined): string {
    return authErrorMessage(error?.code, { status: error?.status, message: error?.message })
}
