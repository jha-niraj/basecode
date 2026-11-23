import { signOutTwin } from '@repo/auth/next'

/**
 * `POST /api/sign-out` under `next dev` (next.config.js rewrites it here). In production worker.ts answers that path
 * before Next and this route is never reached. Keep the two in step.
 */
export const dynamic = 'force-dynamic'

export function POST(request: Request): Promise<Response> {
    return signOutTwin(request)
}
