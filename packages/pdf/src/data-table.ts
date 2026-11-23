// @repo/pdf - a plain data table as a document: the PDF form of any export. Title, meta lines, generated line, then
// rows under a header that repeats on every page, page numbers in the footer. Cells arrive PRE-FORMATTED as text
// (money grouped, dates in the tenant's timezone), so this knows nothing about the data.
import type { PDFFont } from 'pdf-lib'
import { A4, A4_LANDSCAPE, INK, createDocument, fitOneLine, heading, keyValues, paragraph, rule, stampFooter, table, type Column } from './layout'

export interface DataTableColumn {
    header: string
    /** Numbers and money read right-aligned. */
    align?: 'left' | 'right'
}

export interface DataTableInput {
    title: string
    columns: DataTableColumn[]
    rows: string[][]
    /** Label / value lines under the title ("Window", "Last 30 days"). The generated time is added for you. */
    meta?: Array<[string, string]>
    /** Left of every footer ("Acme - Users"). Defaults to the title. */
    footer?: string
    /** A closing note under the table ("Showing the first 5,000 of 8,214 rows"). */
    note?: string | null
    /** When the export was made; defaults to now. Formatted by `formatGenerated` (UTC unless you pass your own). */
    generatedAt?: Date
    formatGenerated?: (d: Date) => string
    /** Portrait up to 6 columns, landscape beyond, unless set. */
    orientation?: 'portrait' | 'landscape'
}

/** More columns than this and portrait is too narrow to read. */
const PORTRAIT_MAX_COLUMNS = 6

/**
 * Column shares from what the cells hold: header length and the 90th percentile of cell lengths (not the max - one long
 * address must not starve every other column), clamped so no column is a sliver or a slab.
 */
function columnShares(input: DataTableInput): number[] {
    const sample = input.rows.slice(0, 400)
    return input.columns.map((col, i) => {
        const lengths = sample.map((r) => (r[i] ?? '').length).sort((a, b) => a - b)
        const p90 = lengths.length ? (lengths[Math.min(lengths.length - 1, Math.floor(lengths.length * 0.9))] ?? 0) : 0
        return Math.min(36, Math.max(5, col.header.length * 0.8, p90))
    })
}

const defaultFormat = (d: Date) => `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`

/** Render a data table PDF. Returns the bytes; serve with `pdfResponse` or store with `@repo/storage` `putObject`. */
export async function renderDataTablePdf(input: DataTableInput): Promise<Uint8Array> {
    const landscape = input.orientation ? input.orientation === 'landscape' : input.columns.length > PORTRAIT_MAX_COLUMNS
    const c = await createDocument({ title: input.title, size: landscape ? A4_LANDSCAPE : A4 })

    heading(c, input.title)
    const generated = (input.formatGenerated ?? defaultFormat)(input.generatedAt ?? new Date())
    keyValues(c, [...(input.meta ?? []), ['Generated', generated], ['Rows', input.rows.length.toLocaleString('en-US')]])
    rule(c)

    if (input.rows.length === 0) {
        paragraph(c, 'No rows to show.', { color: INK.muted })
    } else {
        const size = input.columns.length > 9 ? 7.5 : 8.5
        const shares = columnShares(input)
        const total = shares.reduce((a, b) => a + b, 0) || 1
        const maxWidths = shares.map((s) => (s / total) * c.contentWidth - 8)
        const columns: Column[] = input.columns.map((col, i) => ({
            // A header wider than its column is shortened to one line, never overruns.
            header: fitOneLine(c.fonts.bold, col.header, size, maxWidths[i] ?? 40),
            width: shares[i],
            align: col.align,
        }))
        const rows = input.rows.map((r) => input.columns.map((_, i) => hardBreak(c.fonts.regular, r[i] ?? '', size, maxWidths[i] ?? 40)))
        table(c, columns, rows, { size, repeatHeader: true })
    }

    if (input.note) {
        c.gap(8)
        paragraph(c, input.note, { size: 8, color: INK.faint })
    }
    stampFooter(c, input.footer ?? input.title)
    return c.doc.save()
}

/** Break any token wider than the column so a long email or id cannot run over its neighbour. */
function hardBreak(font: PDFFont, text: string, size: number, maxWidth: number): string {
    if (!text) return ''
    return text.split(/(\s+)/).map((token) => {
        if (!token.trim() || font.widthOfTextAtSize(token, size) <= maxWidth) return token
        const parts: string[] = []
        let cur = ''
        for (const ch of token) {
            if (cur && font.widthOfTextAtSize(cur + ch, size) > maxWidth) { parts.push(cur); cur = ch } else cur += ch
        }
        if (cur) parts.push(cur)
        return parts.join(' ')
    }).join('')
}
