/**
 * @repo/auth - server entry. Import only from server components, server actions and route handlers.
 *
 *   import { auth } from '@repo/auth'                     the better-auth instance (auth.api.*)
 *   import { getSession, requireSession } from '@repo/auth/next'
 *   import { authClient, signIn, useSession, useSignOut } from '@repo/auth/client'
 *   import { safeReturnTo } from '@repo/auth/return-to'
 *   import { isSignedIn } from '@repo/auth/middleware'   cookie-only, for middleware.ts
 *   import { SIGN_OUT_PATH, signOutResponse, ... } from '@repo/auth/sign-out'   for worker.ts
 */
export { auth, isGoogleConfigured } from './server'
export type { Auth, Session, SessionUser } from './server'

// Passwords live in @repo/crypto/password; re-exported for callers that already import them from here.
export { hashPassword, verifyPassword } from '@repo/crypto/password'
