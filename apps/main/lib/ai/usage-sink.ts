import 'server-only'
import { setAiUsageSink } from '@repo/ai'
import { logAiUsage } from '@repo/billing'
import { db } from '@repo/db'

/**
 * Registers the app's usage sink once per isolate: every model call @repo/ai makes is priced by @repo/billing's meter
 * and written to `ai_usage_log`. Import this module (side effect) from any server file that calls the AI.
 */
setAiUsageSink((record) => logAiUsage(db, record))

export const usageSinkRegistered = true
