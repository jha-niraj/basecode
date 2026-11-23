import { existsSync } from 'fs';
import { join } from 'path';
import { APPS_WITH_ENV, appDir, hostLabel, isPlaceholder, readEnv } from './env-files.mts';

/**
 * `pnpm env:check`. Prints key NAMES and host labels, never a value. Each app's three files must carry the same keys; the
 * values that have to agree between apps must agree; staging and local must share a database; production must not.
 * Exit 1 on a problem, so a deploy can run it first.
 */
const FILES = ['.env.local', '.env', '.env.production'] as const;
/** Apps that must hold the same value for a key, because one signs or encrypts what the other reads. */
const MUST_MATCH: Record<string, readonly (typeof APPS_WITH_ENV)[number][]> = {
    DATABASE_URL: APPS_WITH_ENV,
};

const problems: string[] = [];
const pending: string[] = [];
for (const app of APPS_WITH_ENV) {
    const env = new Map(FILES.filter((f) => existsSync(join(appDir(app), f))).map((f) => [f, readEnv(join(appDir(app), f))]));
    for (const f of FILES) if (!env.has(f)) problems.push(`${app}: ${f} is missing`);
    const all = new Set([...env.values()].flatMap((m) => [...m.keys()]));
    for (const [f, m] of env) {
        const missing = [...all].filter((k) => !m.has(k));
        if (missing.length) problems.push(`${app}/${f} lacks ${missing.join(', ')}`);
        const holes = [...m].filter(([, v]) => isPlaceholder(v)).map(([k]) => k);
        if (holes.length) pending.push(`${app}/${f}: ${holes.join(', ')}`);
        if (f !== '.env.local') {
            const local = [...m].filter(([k, v]) => k !== 'DATABASE_URL' && /localhost|127\.0\.0\.1/.test(v)).map(([k]) => k);
            if (local.length) problems.push(`${app}/${f} points at localhost: ${local.join(', ')}`);
        }
    }
    const [local, staging, prod] = [env.get('.env.local'), env.get('.env'), env.get('.env.production')];
    if (local && staging && local.get('DATABASE_URL') !== staging.get('DATABASE_URL')) problems.push(`${app}: .env.local and .env use different databases`);
    if (prod && staging && prod.has('DATABASE_URL') && prod.get('DATABASE_URL') === staging.get('DATABASE_URL')) {
        problems.push(`${app}: .env.production uses the STAGING database`);
    }
    if (local && staging && local.get('BETTER_AUTH_SECRET') !== staging.get('BETTER_AUTH_SECRET')) {
        problems.push(`${app}: .env.local and .env have different BETTER_AUTH_SECRET, but one database: sessions and encrypted values could not be read`);
    }
}
for (const file of FILES) {
    for (const [key, apps] of Object.entries(MUST_MATCH)) {
        const values = apps.flatMap((a) => {
            const v = existsSync(join(appDir(a), file)) ? readEnv(join(appDir(a), file)).get(key) : undefined;
            return v === undefined ? [] : [{ a, v }];
        });
        if (new Set(values.map((x) => x.v)).size > 1) {
            const groups = key === 'DATABASE_URL' ? values.map((x) => `${x.a}=${hostLabel(x.v)}`).join(', ') : values.map((x) => x.a).join(', ');
            problems.push(`${file}: ${key} differs between apps (${groups})`);
        }
    }
}

for (const [f, app] of [['.env.local', 'main'], ['.env', 'main'], ['.env.production', 'main']] as const) {
    console.log(`${f.padEnd(16)} database: ${hostLabel(readEnv(join(appDir(app), f)).get('DATABASE_URL'))}`);
}
if (pending.length) console.log(`\nStill to fill in:\n  ${pending.join('\n  ')}`);
if (problems.length) {
    console.error(`\n${problems.length} problem(s):\n  ${problems.join('\n  ')}`);
    process.exit(1);
}
console.log('\nOK: every app has three files with the same keys.');
