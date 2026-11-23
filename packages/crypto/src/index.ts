import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Deterministic sha256 hex of a value. Used to index high-entropy secrets (API keys)
 * so they can be looked up in O(1) without ever storing or querying the raw secret.
 * Any other service that looks a key up must hash it the same way (utf8, hex).
 */
export function sha256Hex(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * sha256 hex of raw BYTES, not of a string. Separate from `sha256Hex` on purpose: that one
 * pins utf8, and running a PDF buffer through a utf8 decode would mangle it into a hash of
 * something other than the file. Use it to content-address a stored document, so anyone who
 * downloads the file can reproduce the hash with `sha256sum`.
 */
export function sha256HexBytes(bytes: Buffer | Uint8Array): string {
    return createHash('sha256').update(bytes).digest('hex');
}

function getKey(): Buffer {
    const keyHex = process.env.APP_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        throw new Error('APP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a string in the format: iv_hex:auth_tag_hex:encrypted_hex
 */
export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a value produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted value format');
    const [ivHex, tagHex, encryptedHex] = parts as [string, string, string];
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
}

/**
 * Returns true if the value looks like it was produced by encrypt().
 * Used to handle both plain-text (legacy) and encrypted values gracefully.
 */
export function isEncrypted(value: string): boolean {
    const parts = value.split(':');
    return parts.length === 3 && parts[0]!.length === 24 && parts[1]!.length === 32;
}

/**
 * Safely decrypts a value that may or may not already be encrypted.
 * If decryption fails (e.g. wrong key), returns null.
 */
export function safeDecrypt(value: string | null | undefined): string | null {
    if (!value) return null;
    if (!isEncrypted(value)) return value; // legacy plain-text
    try {
        return decrypt(value);
    } catch {
        return null;
    }
}

// ── Personal identifiers at rest ─────────────────
//
// Citizenship, birth-certificate and PAN numbers, and salary bank details, are stored ENCRYPTED.
// A `pii1:` prefix marks the format so a reader can tell an encrypted value from a legacy plain one
// (and from text that merely happens to contain colons), and so the scheme can be versioned.
// Same AES-256-GCM and APP_ENCRYPTION_KEY as `encrypt`. Every write goes through
// `encryptPii`; every read that shows the value goes through `decryptPii` (or `maskPii`).

const PII_PREFIX = 'pii1:';

/** True for a value written by `encryptPii`. */
export function isPiiEncrypted(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.startsWith(PII_PREFIX);
}

/** Encrypt a personal identifier for storage. Empty stays null; an already-encrypted value is kept. */
export function encryptPii(value: string | null | undefined): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (isPiiEncrypted(trimmed)) return trimmed;
    return PII_PREFIX + encrypt(trimmed);
}

/**
 * The plain value. Legacy plain-text rows pass through unchanged. A value that cannot be decrypted
 * (wrong key) returns null rather than ciphertext, so it can never be shown or exported by accident.
 */
export function decryptPii(value: string | null | undefined): string | null {
    if (!value) return null;
    if (!isPiiEncrypted(value)) return value;
    try {
        return decrypt(value.slice(PII_PREFIX.length));
    } catch {
        return null;
    }
}

/** For display without permission to reveal: `••••4521`. Works on encrypted or plain input. */
export function maskPii(value: string | null | undefined, visible = 4): string | null {
    const plain = decryptPii(value);
    if (!plain) return null;
    const tail = plain.slice(-visible);
    return `${'•'.repeat(Math.max(4, Math.min(8, plain.length - visible)))}${tail}`;
}
