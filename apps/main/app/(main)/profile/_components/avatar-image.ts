export const AVATAR_SIZE = 512
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp"
const MAX_SOURCE_BYTES = 15 * 1024 * 1024

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
            URL.revokeObjectURL(url)
            resolve(img)
        }
        img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error("That file could not be read as an image."))
        }
        img.src = url
    })
}

/** Centre-crops to a square and scales to at most 512px, in the browser, before upload. JPEG: every browser encodes it. */
export async function cropAvatar(file: File): Promise<Blob> {
    if (!AVATAR_ACCEPT.split(",").includes(file.type)) throw new Error("Use a JPG, PNG or WebP image.")
    if (file.size > MAX_SOURCE_BYTES) throw new Error("That image is too large - pick one under 15 MB.")

    const img = await loadImage(file)
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    if (!side) throw new Error("That image is empty.")
    const sx = (img.naturalWidth - side) / 2
    const sy = (img.naturalHeight - side) / 2
    const out = Math.min(AVATAR_SIZE, side)

    const canvas = document.createElement("canvas")
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Your browser could not process the image.")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, out, out)
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88))
    if (!blob) throw new Error("Your browser could not process the image.")
    return blob
}
