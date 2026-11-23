// @repo/storage - Cloudflare R2 over fetch + SigV4 (no AWS SDK). Reads env at call time; nothing throws at import.
//
// The rule: a stored file column holds the object KEY (`*Key`), never a URL. A signed URL expires and the database does
// not; render a stored value through `storageHref()`.
import { presignUrl, signRequest, type SigV4Credentials } from './sigv4'

interface R2Env {
    accessKeyId: string
    secretAccessKey: string
    bucket: string
    endpoint: string
}

const R2_ENV = {
    accountId: 'R2_ACCOUNT_ID',
    accessKeyId: 'R2_ACCESS_KEY_ID',
    secretAccessKey: 'R2_SECRET_ACCESS_KEY',
    bucket: 'R2_BUCKET_NAME',
} as const

function readEnv(name: string): string | undefined {
    const v = process.env[name]?.trim()
    return v ? v : undefined
}

/** Names of the missing R2 variables (whitespace-only counts as missing). */
export function missingStorageEnv(): string[] {
    return Object.values(R2_ENV).filter((name) => !readEnv(name))
}

/**
 * True when R2 can store and sign objects (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME).
 * R2_PUBLIC_URL is optional - without it every read goes through a signed URL. Server-only: pass the boolean down.
 */
export function isStorageConfigured(): boolean {
    return missingStorageEnv().length === 0
}

/** True when the bucket also has a public domain (R2_PUBLIC_URL), so `getPublicUrl` works. */
export function isPublicStorageConfigured(): boolean {
    return isStorageConfigured() && Boolean(readEnv('R2_PUBLIC_URL'))
}

function r2(): R2Env {
    const missing = missingStorageEnv()
    if (missing.length > 0) {
        throw new Error(`R2 is not configured - ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} not set`)
    }
    return {
        accessKeyId: readEnv(R2_ENV.accessKeyId) as string,
        secretAccessKey: readEnv(R2_ENV.secretAccessKey) as string,
        bucket: readEnv(R2_ENV.bucket) as string,
        endpoint: `https://${readEnv(R2_ENV.accountId) as string}.r2.cloudflarestorage.com`,
    }
}

function creds(c: R2Env): SigV4Credentials {
    return { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey }
}

/** One hour for reads; fifteen minutes is enough for an upload URL handed straight to a browser. */
export const DEFAULT_DOWNLOAD_TTL = 60 * 60
export const DEFAULT_UPLOAD_TTL = 15 * 60

/**
 * A presigned PUT URL: the browser uploads straight to R2 (`fetch(url, { method: 'PUT', body: file, headers:
 * { 'Content-Type': contentType } })`), so the bytes never pass through the Worker. Persist the KEY afterwards, never
 * this URL. The bucket needs a CORS rule allowing PUT from the app's origin. Only `host` is signed, so validate the
 * content type and size server-side before handing out a key.
 */
export async function getUploadUrl(key: string, _contentType: string, expiresIn = DEFAULT_UPLOAD_TTL): Promise<string> {
    const c = r2()
    return presignUrl({ method: 'PUT', endpoint: c.endpoint, bucket: c.bucket, key, credentials: creds(c), expiresIn })
}

/** A short-lived GET URL for a private object. Never store it. `downloadName` forces a download with that filename. */
export async function getDownloadUrl(
    key: string,
    expiresIn = DEFAULT_DOWNLOAD_TTL,
    opts: { downloadName?: string } = {},
): Promise<string> {
    const c = r2()
    return presignUrl({
        method: 'GET',
        endpoint: c.endpoint,
        bucket: c.bucket,
        key,
        credentials: creds(c),
        expiresIn,
        query: opts.downloadName
            ? { 'response-content-disposition': `attachment; filename="${sanitizeFilename(opts.downloadName)}"` }
            : {},
    })
}

/** Server-side upload of bytes the server already has (a generated PDF, an export). Returns the key to persist. */
export async function putObject(
    key: string,
    body: Uint8Array | ArrayBuffer | string,
    contentType: string,
    opts: { contentDisposition?: string; cacheControl?: string } = {},
): Promise<{ key: string }> {
    const c = r2()
    const bytes =
        typeof body === 'string' ? new TextEncoder().encode(body) : body instanceof Uint8Array ? body : new Uint8Array(body)
    const headers: Record<string, string> = { 'content-type': contentType }
    if (opts.contentDisposition) headers['content-disposition'] = opts.contentDisposition
    if (opts.cacheControl) headers['cache-control'] = opts.cacheControl
    const signed = await signRequest({
        method: 'PUT', endpoint: c.endpoint, bucket: c.bucket, key, credentials: creds(c), body: bytes, headers,
    })
    const res = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: bytes as unknown as BodyInit })
    if (!res.ok) throw new Error(`R2 put failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 300)}`)
    return { key }
}

/** Fetch an object's bytes server-side; null when it does not exist. */
export async function getObject(key: string): Promise<{ body: Uint8Array; contentType: string | null } | null> {
    const c = r2()
    const signed = await signRequest({ method: 'GET', endpoint: c.endpoint, bucket: c.bucket, key, credentials: creds(c) })
    const res = await fetch(signed.url, { headers: signed.headers })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`R2 get failed (${res.status})`)
    return { body: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get('content-type') }
}

/** Does the object exist? A HEAD, so the body is not pulled. */
export async function objectExists(key: string): Promise<boolean> {
    const c = r2()
    const signed = await signRequest({ method: 'HEAD', endpoint: c.endpoint, bucket: c.bucket, key, credentials: creds(c) })
    const res = await fetch(signed.url, { method: 'HEAD', headers: signed.headers })
    return res.ok
}

/** Delete an object. A 404 counts as success - the end state is "gone". Check ownership before calling. */
export async function deleteFile(key: string): Promise<void> {
    const c = r2()
    const signed = await signRequest({ method: 'DELETE', endpoint: c.endpoint, bucket: c.bucket, key, credentials: creds(c) })
    const res = await fetch(signed.url, { method: 'DELETE', headers: signed.headers })
    if (!res.ok && res.status !== 404) throw new Error(`R2 delete failed (${res.status})`)
}

/** The public URL of a key on a bucket with a public domain. Throws naming R2_PUBLIC_URL when it is not set. */
export function getPublicUrl(key: string): string {
    const base = readEnv('R2_PUBLIC_URL')
    if (!base) throw new Error('R2_PUBLIC_URL is not set')
    return `${base.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * The object key behind a URL on this bucket - R2_PUBLIC_URL, `*.r2.dev`, or the account endpoint (signed or not).
 * Null for anything else (an external URL such as a Google avatar). Repairs legacy rows that stored a URL.
 */
export function keyFromPublicUrl(url: string | null | undefined): string | null {
    if (!url || !/^https?:\/\//i.test(url)) return null
    const base = readEnv('R2_PUBLIC_URL')?.replace(/\/$/, '')
    if (base && url.startsWith(`${base}/`)) {
        const key = url.slice(base.length + 1).split(/[?#]/)[0]
        return key ? decodeURIComponent(key) : null
    }
    try {
        const u = new URL(url)
        if (u.hostname.endsWith('.r2.cloudflarestorage.com') || u.hostname.endsWith('.r2.dev')) {
            let path = decodeURIComponent(u.pathname.replace(/^\/+/, ''))
            const bucket = readEnv(R2_ENV.bucket)
            // Path-style account URLs carry the bucket as the first segment.
            if (bucket && path.startsWith(`${bucket}/`) && !u.hostname.startsWith(`${bucket}.`)) {
                path = path.slice(bucket.length + 1)
            }
            return path || null
        }
    } catch {
        // not a parseable URL - not ours
    }
    return null
}

/** Safe for an object key and a Content-Disposition header; capped (S3 keys max 1024 bytes). */
export function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '-').substring(0, 200)
}

/**
 * A unique key: `{prefix}/{ownerId}/{timestamp}-{random}.{ext}`. The owner id as the SECOND segment is what
 * `/api/documents/files/...` checks before signing a private read (see `ownerFromKey`).
 */
export function generateKey(prefix: string, ownerId: string, fileName: string): string {
    const dot = fileName.lastIndexOf('.')
    const rawExt = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) : ''
    const ext = rawExt || 'bin'
    const rand = crypto.randomUUID().slice(0, 8)
    return `${prefix}/${ownerId}/${Date.now()}-${rand}.${ext}`
}

/** The owner id segment of a key made by `generateKey`, or null for any other shape. */
export function ownerFromKey(key: string): string | null {
    const parts = key.split('/')
    return parts.length >= 3 && parts[1] ? parts[1] : null
}
