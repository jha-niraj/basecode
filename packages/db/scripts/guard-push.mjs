// `pnpm db:push` runs this first. Push applies EVERY difference it finds, drops included, so it is only for a fresh
// database. After that, write an additive idempotent script in packages/db/scripts/ and run it twice.
if (process.env.ALLOW_DB_PUSH !== '1') {
    console.error('Refusing db:push. It is for a FRESH database only: ALLOW_DB_PUSH=1 pnpm db:push')
    process.exit(1)
}
