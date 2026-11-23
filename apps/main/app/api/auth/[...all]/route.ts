import { auth } from '@repo/auth'
import { toNextJsHandler } from '@repo/auth/next'

export const dynamic = 'force-dynamic'

export const { GET, POST } = toNextJsHandler(auth)
