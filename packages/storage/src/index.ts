/**
 * @repo/storage - Cloudflare R2 object storage over fetch (hand-rolled SigV4 on SubtleCrypto, no AWS SDK).
 *
 * Owns: keys, presigned upload / download URLs, server-side put / get / delete, and turning a stored value into an href.
 *
 * Rules
 * - A stored file column holds the object KEY (`avatarKey`, `fileKey`), never a URL. Render it through `storageHref()`.
 * - Env is read at call time: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME (required),
 *   R2_PUBLIC_URL (optional public domain). Check `isStorageConfigured()` before offering an upload; a call without
 *   config throws an error naming the missing variables.
 * - Upload flow: server action -> `generateKey(prefix, userId, fileName)` + `getUploadUrl(key, contentType)` -> the
 *   browser PUTs the file -> the action saves the key.
 *
 *   const key = generateKey('avatars', user.id, file.name)
 *   const url = await getUploadUrl(key, file.type)
 *   // browser: await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
 *   // later:   <img src={storageHref(user.image)} />
 */
export {
    isStorageConfigured,
    isPublicStorageConfigured,
    missingStorageEnv,
    getUploadUrl,
    getDownloadUrl,
    putObject,
    getObject,
    objectExists,
    deleteFile,
    getPublicUrl,
    keyFromPublicUrl,
    generateKey,
    ownerFromKey,
    sanitizeFilename,
    DEFAULT_DOWNLOAD_TTL,
    DEFAULT_UPLOAD_TTL,
} from './r2'
export { storageHref, signedStorageUrl, isResolvedStorageValue, PRIVATE_FILE_ROUTE } from './href'
