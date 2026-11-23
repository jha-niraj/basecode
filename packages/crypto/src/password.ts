/**
 * THE password hash for every app, the seed and any script: native scrypt from `node:crypto`, in better-auth's own
 * format (`<hexSalt>:<hexKey>`, N=16384 r=16 p=1, 64-byte key, NFKC), so better-auth and our own routes read and write
 * one format. ~30 ms on Workers; the pure-JS bcrypt it replaced elsewhere took 0.8-1.5 s per sign-in. Never bcrypt.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 16384;
const R = 16;
const P = 1;
const KEY_LEN = 64;

function deriveKey(password: string, salt: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scrypt(password.normalize('NFKC'), salt, KEY_LEN, { N, r: R, p: P, maxmem: 128 * N * R * 2 }, (err, key) => {
            if (err) reject(err);
            else resolve(key);
        });
    });
}

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const key = await deriveKey(password, salt);
    return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
    if (!hash) return false;
    const [salt, key] = hash.split(':');
    if (!salt || !key) return false;
    const expected = Buffer.from(key, 'hex');
    const actual = await deriveKey(password, salt);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Constant-time string compare for secrets (cron bearer, webhook signatures). Never `===` on a secret. */
export function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) {
        timingSafeEqual(ab, ab);
        return false;
    }
    return timingSafeEqual(ab, bb);
}
