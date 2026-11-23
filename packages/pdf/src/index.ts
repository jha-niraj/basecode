/**
 * @repo/pdf - PDF generation on pdf-lib + @pdf-lib/fontkit (pure JS, Workers-safe) and text extraction with unpdf.
 *
 * Owns: the layout kit (pages, margins, wrapped text, headings, key/value lines, tables with a repeating header, footer
 * page numbers), font loading (Unicode TTF subset, Helvetica fallback), the data-table document, filenames, and
 * `extractPdfText`.
 *
 * - Fonts: call `setPdfFontSource(fontSourceFromUrls(regularTtfUrl, boldTtfUrl))` once at startup to print ₹ and
 *   non-Latin scripts; without it documents use Helvetica and `safeText` (₹ prints "Rs"). Never fails a document.
 * - A renderer takes pre-formatted strings and returns bytes. It never reads the database or storage: the caller
 *   fetches, the package draws, the caller serves (`pdfResponse`) or stores (`@repo/storage` putObject, keep the KEY).
 * - Rendering is CPU work: a few hundred rows inline is fine; thousands of pages belong in a long job.
 * - Check new documents by rendering one and LOOKING at it - tofu boxes pass every automated check.
 *
 *   const bytes = await renderDataTablePdf({ title: 'Users', columns: [{ header: 'Name' }], rows: [['Asha']] })
 *   return pdfResponse(bytes, pdfFilename({ type: 'users' }))
 */
export {
    A4, A4_LANDSCAPE, LETTER, DEFAULT_MARGINS, INK, Cursor, createDocument, wrapText, fitOneLine, paragraph, heading,
    rule, keyValues, table, stampFooter,
    type PageSize, type Margins, type CreateDocumentInput, type TextOptions, type Column, type TableOptions,
} from './layout'
export { setPdfFontSource, fontSourceFromUrls, loadFonts, safeText, type PdfFontSource, type Fonts } from './fonts'
export { renderDataTablePdf, type DataTableInput, type DataTableColumn } from './data-table'
export { pdfFilename, pdfResponse, slugifyForFilename, type PdfFilenameInput } from './filename'
export { extractPdfText, type ExtractedPdfText } from './extract'
