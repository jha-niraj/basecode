/**
 * Seeds the super admin. Idempotent: run it as often as you like.
 *
 *   SEED_ADMIN_EMAIL     default superadmin@example.com
 *   SEED_ADMIN_PASSWORD  if unset, a random one is generated and printed ONCE
 *
 * No password lives in this file: a committed default is a password every clone shares.
 * Run: pnpm db:seed (reads apps/main/.env.local)
 */

import { randomBytes } from 'node:crypto'
import { hashPassword } from '@repo/crypto/password'
import { db } from './client'
import * as schema from './schema/index'

const EMAIL = process.env.SEED_ADMIN_EMAIL || 'superadmin@example.com'
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString('base64url')
const USER_ID = 'seed-superadmin-001'

async function seed() {
    console.log('Seeding super admin...')

    // Check if already seeded
    const existing = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.email, EMAIL),
    })

    if (existing) {
        console.log('Super admin already exists. Skipping.')
        return
    }

    // The one password format (@repo/crypto/password): better-auth is configured to read it.
    const hashedPassword = await hashPassword(PASSWORD)

    // 1 - User record
    await db.insert(schema.user).values({
        id: USER_ID,
        email: EMAIL,
        name: 'Super Admin',
        emailVerified: true,
        role: 'ADMIN',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    })

    // 2 - Credential account (Better Auth reads account.password for sign-in)
    await db.insert(schema.account).values({
        id: crypto.randomUUID(),
        accountId: USER_ID,
        providerId: 'credential',
        userId: USER_ID,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
    })

    // 3 - Admin access with full SUPER_ADMIN permissions
    await db.insert(schema.adminAccess).values({
        userId: USER_ID,
        adminRole: 'SUPER_ADMIN',
        status: 'ACTIVE',
        permissions: {
            users: ['read', 'write', 'delete', 'full'],
            analytics: ['read', 'write', 'full'],
            communications: ['read', 'write', 'delete', 'full'],
            admin_management: ['read', 'write', 'delete', 'full'],
            system: ['read', 'write', 'full'],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
    })

    console.log('Super admin seeded')
    console.log(`  Email:    ${EMAIL}`)
    console.log(process.env.SEED_ADMIN_PASSWORD ? '  Password: (from SEED_ADMIN_PASSWORD)' : `  Password: ${PASSWORD}  (shown once - change it after signing in)`)
}

seed().catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
})
