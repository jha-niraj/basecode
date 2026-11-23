// @repo/pdf - text out of a PDF with unpdf (pdf.js built for serverless; no canvas, runs on Workers).
// Scanned PDFs have no text layer: an empty result means "needs OCR" - use @repo/sarvamai `digitiseDocument`.
import { extractText, getDocumentProxy } from 'unpdf'

export interface ExtractedPdfText {
    /** All pages joined with blank lines. */
    text: string
    /** One entry per page. */
    pages: string[]
    totalPages: number
    /** True when there is (almost) no text layer - a scan; OCR it instead. */
    looksScanned: boolean
}

/** Extract the text layer of a PDF. Throws on a file that is not a PDF or is encrypted. */
export async function extractPdfText(bytes: Uint8Array | ArrayBuffer): Promise<ExtractedPdfText> {
    // pdf.js may transfer (detach) the buffer it is given, so hand it a copy.
    const data = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes.slice(0))
    const pdf = await getDocumentProxy(data)
    const { totalPages, text } = await extractText(pdf, { mergePages: false })
    const pages = (Array.isArray(text) ? text : [text]).map((p) => p.trim())
    const joined = pages.join('\n\n').trim()
    return { text: joined, pages, totalPages, looksScanned: joined.replace(/\s+/g, '').length < 20 * Math.max(1, totalPages) }
}
