// @repo/storage - AWS Signature Version 4, the subset R2 needs, on SubtleCrypto (Workers-safe, no AWS SDK).
//
// Why not the AWS SDK: @aws-sdk/client-s3 + the presigner are most of a megabyte per bundle to sign a string, and a
// Worker has a hard size limit. R2 needs PUT / GET / DELETE / HEAD and a presigned URL - one algorithm, four shapes.
//
// The parts that must be exact (a mismatch fails only on some inputs, the worst kind of failure):
//  - Path: every segment percent-encoded (RFC 3986, incl. !'()*), the `/` between segments NOT encoded.
//  - Query: sorted by encoded key then encoded value.
//  - Headers: lowercased names, trimmed values, sorted; the signed-header list is the same names joined by `;`.
//  - Presigned URLs sign `UNSIGNED-PAYLOAD` (sent and signed, as the AWS SDK does).
//  - X-Amz-Date and the scope date come from ONE instant (two `new Date()` calls straddle midnight now and then).

export interface SigV4Credentials {
    accessKeyId: string
    secretAccessKey: string
}

export type SigV4Method = 'GET' | 'PUT' | 'HEAD' | 'DELETE'

const SERVICE = 's3'
const REGION = 'auto' // R2 ignores the region, SigV4 needs one in the scope
const ALGORITHM = 'AWS4-HMAC-SHA256'
const UNSIGNED_PAYLOAD = 'UNSIGNED-PAYLOAD'
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

const encoder = new TextEncoder()

function toHex(buf: ArrayBuffer | Uint8Array): string {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    let out = ''
    for (const b of bytes) out += b.toString(16).padStart(2, '0')
    return out
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data
    return toHex(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource))
}

async function hmac(key: string | Uint8Array, data: string): Promise<Uint8Array> {
    const raw = typeof key === 'string' ? encoder.encode(key) : key
    const k = await crypto.subtle.importKey('raw', raw as unknown as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, encoder.encode(data)))
}

/** RFC 3986 percent-encoding (`encodeURIComponent` leaves `!'()*`, AWS wants them encoded). */
export function uriEncode(value: string): string {
    return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/** Each key segment encoded, the separators left alone. */
export function encodePath(key: string): string {
    return `/${key.split('/').map(uriEncode).join('/')}`
}

export function canonicalQuery(params: Record<string, string>): string {
    return Object.entries(params)
        .map(([k, v]) => [uriEncode(k), uriEncode(v)] as const)
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
}

function stamps(now: Date): { amzDate: string; dateStamp: string } {
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    return { amzDate, dateStamp: amzDate.slice(0, 8) }
}

async function signature(secret: string, dateStamp: string, amzDate: string, canonicalRequest: string): Promise<string> {
    const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
    const stringToSign = [ALGORITHM, amzDate, scope, await sha256Hex(canonicalRequest)].join('\n')
    const kDate = await hmac(`AWS4${secret}`, dateStamp)
    const kRegion = await hmac(kDate, REGION)
    const kService = await hmac(kRegion, SERVICE)
    const kSigning = await hmac(kService, 'aws4_request')
    return toHex(await hmac(kSigning, stringToSign))
}

/** Virtual-hosted addressing (`<bucket>.<account>.r2.cloudflarestorage.com/<key>`) - what the AWS SDK emits. */
function address(endpoint: string, bucket: string): { origin: string; host: string } {
    const url = new URL(endpoint)
    const host = `${bucket}.${url.host}`
    return { origin: `${url.protocol}//${host}`, host }
}

export interface PresignInput {
    method: SigV4Method
    endpoint: string
    bucket: string
    key: string
    credentials: SigV4Credentials
    /** Seconds; 1 second to 7 days. */
    expiresIn: number
    /** Extra signed query params, e.g. `response-content-disposition`. */
    query?: Record<string, string>
    now?: Date
}

/** A presigned URL: everything in the query string, only `host` signed, so a browser needs no headers. */
export async function presignUrl(input: PresignInput): Promise<string> {
    const { method, endpoint, bucket, key, credentials, expiresIn, query = {} } = input
    if (expiresIn < 1 || expiresIn > 604800) throw new Error('presignUrl: expiresIn must be between 1 second and 7 days')
    const { origin, host } = address(endpoint, bucket)
    const { amzDate, dateStamp } = stamps(input.now ?? new Date())
    const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
    const signedQuery: Record<string, string> = {
        ...query,
        'X-Amz-Algorithm': ALGORITHM,
        'X-Amz-Content-Sha256': UNSIGNED_PAYLOAD,
        'X-Amz-Credential': `${credentials.accessKeyId}/${scope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': String(Math.floor(expiresIn)),
        'X-Amz-SignedHeaders': 'host',
    }
    const path = encodePath(key)
    const qs = canonicalQuery(signedQuery)
    const canonicalRequest = [method, path, qs, `host:${host}\n`, 'host', UNSIGNED_PAYLOAD].join('\n')
    const sig = await signature(credentials.secretAccessKey, dateStamp, amzDate, canonicalRequest)
    return `${origin}${path}?${qs}&X-Amz-Signature=${sig}`
}

export interface SignedRequestInput {
    method: SigV4Method
    endpoint: string
    bucket: string
    key: string
    credentials: SigV4Credentials
    body?: Uint8Array
    headers?: Record<string, string>
    now?: Date
}

/** Headers for a server-to-server request; signs the real payload hash. */
export async function signRequest(input: SignedRequestInput): Promise<{ url: string; headers: Record<string, string> }> {
    const { method, endpoint, bucket, key, credentials, body, headers = {} } = input
    const { origin, host } = address(endpoint, bucket)
    const { amzDate, dateStamp } = stamps(input.now ?? new Date())
    const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
    const payloadHash = body && body.length > 0 ? await sha256Hex(body) : EMPTY_SHA256

    const all: Record<string, string> = {}
    for (const [k, v] of Object.entries(headers)) all[k.toLowerCase()] = v.trim()
    all.host = host
    all['x-amz-content-sha256'] = payloadHash
    all['x-amz-date'] = amzDate

    const names = Object.keys(all).sort()
    const canonicalHeaders = names.map((n) => `${n}:${all[n]}\n`).join('')
    const signedHeaders = names.join(';')
    const path = encodePath(key)
    const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
    const sig = await signature(credentials.secretAccessKey, dateStamp, amzDate, canonicalRequest)

    // `host` is signed but never sent by hand - fetch sets it (it is a forbidden request header).
    const sendHeaders: Record<string, string> = { ...all }
    delete sendHeaders.host
    return {
        url: `${origin}${path}`,
        headers: {
            ...sendHeaders,
            Authorization: `${ALGORITHM} Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
        },
    }
}
