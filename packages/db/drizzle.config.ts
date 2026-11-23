import { defineConfig } from 'drizzle-kit'

// `db:push` creates tables on a FRESH database only (it refuses without ALLOW_DB_PUSH=1, see package.json). Once a
// database holds data that matters, every change is an additive, idempotent SQL script in packages/db/scripts/, run
// twice - push applies every drift it finds, including drops.
export default defineConfig({
    schema: './src/schema/index.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: { url: process.env.DATABASE_URL! },
})
