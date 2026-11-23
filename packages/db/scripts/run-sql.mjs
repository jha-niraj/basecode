// Run an additive, idempotent SQL file against DATABASE_URL. Previews by default; writes only with --apply.
//   pnpm --filter @repo/db sql scripts/<file>.sql [--apply]
// Neon over HTTP takes one statement per request, so the file is split on `;` outside quotes and `$$` blocks.
import { readFileSync } from 'node:fs'
import { neon } from '@neondatabase/serverless'

const file = process.argv.find((a) => a.endsWith('.sql'))
const apply = process.argv.includes('--apply')
const url = process.env.DATABASE_URL
if (!file) throw new Error('Pass a .sql file')
if (!url) throw new Error('DATABASE_URL is not set')

function split(text) {
    const out = []
    let cur = ''
    let dollar = false
    let quote = false
    for (let i = 0; i < text.length; i++) {
        const c = text[i]
        if (!quote && text.startsWith('$$', i)) { dollar = !dollar; cur += '$$'; i++; continue }
        if (!dollar && c === "'") quote = !quote
        if (!dollar && !quote && c === '-' && text[i + 1] === '-') { const nl = text.indexOf('\n', i); i = nl === -1 ? text.length : nl; cur += '\n'; continue }
        if (!dollar && !quote && c === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue }
        cur += c
    }
    if (cur.trim()) out.push(cur.trim())
    return out
}

const statements = split(readFileSync(file, 'utf8'))
console.log(`Target database: ${new URL(url).hostname.split('.')[0]} - ${statements.length} statement(s) in ${file}${apply ? '' : ' (preview - add --apply to run)'}`)
const sql = neon(url)
for (const s of statements) {
    const first = s.split('\n')[0].slice(0, 100)
    if (!apply) { console.log(`  would run: ${first}`); continue }
    await sql.query(s)
    console.log(`  ran: ${first}`)
}
