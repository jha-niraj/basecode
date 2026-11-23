// @repo/storage - turning a stored value into something a browser can open.
import { getDownloadUrl, getPublicUrl, keyFromPublicUrl } from './r2'

/** The app route that signs a private object per request (apps/main/app/api/documents/[...path]/route.ts). */
export const PRIVATE_FILE_ROUTE = '/api/documents/files'

/** True for a value that is already a URL, an app path, or a data/blob URL - not an R2 key. */
export function isResolvedStorageValue(value: string): boolean {
    return /^(https?:|data:|blob:)/i.test(value) || value.startsWith('/')
}

/**
 * A stored file value -> an href for markup (`<img src>`, `<a href>`). Server-side (reads env).
 *
 * - An absolute URL (a Google avatar, a legacy row), an app path, a data URL: returned unchanged.
 * - A key on a bucket with R2_PUBLIC_URL: the public URL.
 * - A key on a private bucket: a stable same-origin path (`/api/documents/files/<key>`) that checks the session and
 *   redirects to a short-lived signed URL on each request, so the link in markup never goes stale.
 *
 * Never store the result.
 */
export function storageHref(value: string): string
export function storageHref(value: string | null | undefined): string | null
export function storageHref(value: string | null | undefined): string | null {
    if (!value) return null
    if (isResolvedStorageValue(value)) return value
    if (process.env.R2_PUBLIC_URL?.trim()) return getPublicUrl(value)
    return `${PRIVATE_FILE_ROUTE}/${value.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * A stored value -> a short-lived direct URL, for immediate use only (a redirect, an email link, `window.open`).
 * External URLs pass through; a legacy R2 URL is re-signed from its key.
 */
export async function signedStorageUrl(value: string, expiresIn = 900): Promise<string> {
    const legacyKey = keyFromPublicUrl(value)
    if (legacyKey) return getDownloadUrl(legacyKey, expiresIn)
    if (isResolvedStorageValue(value)) return value
    return getDownloadUrl(value, expiresIn)
}
