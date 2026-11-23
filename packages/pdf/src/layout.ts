// @repo/pdf - the layout kit: a cursor that flows content down pages (pdf-lib has no layout of its own).
//
//   const c = await createDocument({ title: 'Users' })
//   heading(c, 'Users')
//   paragraph(c, 'Everyone with an account.', { color: INK.muted })
//   table(c, [{ header: 'Name' }, { header: 'Joined', align: 'right' }], rows)
//   stampFooter(c, 'Acme - Users')
//   const bytes = await c.doc.save()
//
// Coordinates: pdf-lib's origin is bottom-left; the cursor's `y` is the BASELINE position counted from the bottom and
// moves down as content is added. Every helper calls `ensure()` first, so content never runs into the bottom margin.
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import { loadFonts, type Fonts } from './fonts'

export interface PageSize { width: number; height: number }
export const A4: PageSize = { width: 595.28, height: 841.89 }
export const A4_LANDSCAPE: PageSize = { width: 841.89, height: 595.28 }
export const LETTER: PageSize = { width: 612, height: 792 }

export interface Margins { top: number; right: number; bottom: number; left: number }
export const DEFAULT_MARGINS: Margins = { top: 48, right: 44, bottom: 56, left: 44 }

/** Neutral ink. Colour only where it IS the datum. */
export const INK = {
    text: rgb(0.09, 0.09, 0.09),
    muted: rgb(0.32, 0.32, 0.32),
    faint: rgb(0.45, 0.45, 0.45),
    rule: rgb(0.85, 0.85, 0.85),
    panel: rgb(0.96, 0.96, 0.96),
} as const

export class Cursor {
    page: PDFPage
    y: number
    constructor(
        readonly doc: PDFDocument,
        readonly fonts: Fonts,
        readonly size: PageSize,
        readonly margins: Margins,
    ) {
        this.page = doc.addPage([size.width, size.height])
        this.y = size.height - margins.top
    }
    get left(): number { return this.margins.left }
    get right(): number { return this.size.width - this.margins.right }
    get contentWidth(): number { return this.right - this.left }
    get bottom(): number { return this.margins.bottom }
    /** Start a new page with the cursor at the top margin. */
    newPage(): void {
        this.page = this.doc.addPage([this.size.width, this.size.height])
        this.y = this.size.height - this.margins.top
    }
    /** Make room for `height` points; returns true when a page break happened. */
    ensure(height: number): boolean {
        if (this.y - height >= this.bottom) return false
        this.newPage()
        return true
    }
    gap(points: number): void { this.y -= points }
}

export interface CreateDocumentInput {
    title: string
    author?: string
    size?: PageSize
    margins?: Partial<Margins>
}

/** A new document with fonts loaded and one page ready. Sets the PDF title (shown by viewers and in tabs). */
export async function createDocument(input: CreateDocumentInput): Promise<Cursor> {
    const doc = await PDFDocument.create()
    doc.setTitle(input.title)
    if (input.author) doc.setAuthor(input.author)
    doc.setCreator('@repo/pdf')
    doc.setProducer('pdf-lib')
    doc.setCreationDate(new Date())
    const fonts = await loadFonts(doc)
    return new Cursor(doc, fonts, input.size ?? A4, { ...DEFAULT_MARGINS, ...input.margins })
}

/** Split text into lines that fit `maxWidth` (honours `\n`; a single over-long word is broken by characters). */
export function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
    const out: string[] = []
    for (const para of text.split('\n')) {
        const words = para.split(/\s+/).filter(Boolean)
        if (words.length === 0) { out.push(''); continue }
        let line = ''
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word
            if (font.widthOfTextAtSize(candidate, size) <= maxWidth) { line = candidate; continue }
            if (line) out.push(line)
            if (font.widthOfTextAtSize(word, size) <= maxWidth) { line = word; continue }
            let piece = ''
            for (const ch of word) {
                if (piece && font.widthOfTextAtSize(piece + ch, size) > maxWidth) { out.push(piece); piece = ch } else piece += ch
            }
            line = piece
        }
        out.push(line)
    }
    return out
}

/** The text cut to one line with "..." when it does not fit. */
export function fitOneLine(font: PDFFont, text: string, size: number, maxWidth: number): string {
    if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
    let cut = text
    while (cut.length > 1 && font.widthOfTextAtSize(`${cut}...`, size) > maxWidth) cut = cut.slice(0, -1)
    return `${cut.trimEnd()}...`
}

const lineHeight = (size: number) => size * 1.35

export interface TextOptions { size?: number; bold?: boolean; color?: RGB; align?: 'left' | 'center' | 'right' }

/** A wrapped block of text at the cursor; breaks pages line by line. */
export function paragraph(c: Cursor, text: string, opts: TextOptions = {}): void {
    const size = opts.size ?? 10
    const font = opts.bold ? c.fonts.bold : c.fonts.regular
    const lh = lineHeight(size)
    for (const line of wrapText(font, text, size, c.contentWidth)) {
        c.ensure(lh)
        c.y -= size
        const w = font.widthOfTextAtSize(line, size)
        const x = opts.align === 'right' ? c.right - w : opts.align === 'center' ? c.left + (c.contentWidth - w) / 2 : c.left
        c.page.drawText(line, { x, y: c.y, size, font, color: opts.color ?? INK.text })
        c.y -= lh - size
    }
}

/** A heading. Level 1 = document title (18pt), 2 = section (13pt), 3 = sub-section (11pt). Kept with what follows. */
export function heading(c: Cursor, text: string, opts: { level?: 1 | 2 | 3 } = {}): void {
    const size = opts.level === 3 ? 11 : opts.level === 2 ? 13 : 18
    // Never strand a heading at the bottom of a page: reserve the heading plus two body lines.
    c.ensure(lineHeight(size) + lineHeight(10) * 2 + 6)
    if (opts.level && opts.level > 1) c.gap(6)
    paragraph(c, text, { size, bold: true })
    c.gap(opts.level === 1 || !opts.level ? 6 : 3)
}

/** A hairline across the content width. */
export function rule(c: Cursor, opts: { gapAbove?: number; gapBelow?: number } = {}): void {
    c.gap(opts.gapAbove ?? 6)
    c.ensure(1)
    c.page.drawLine({ start: { x: c.left, y: c.y }, end: { x: c.right, y: c.y }, thickness: 0.5, color: INK.rule })
    c.gap(opts.gapBelow ?? 8)
}

/** Label / value pairs in two columns ("Generated", "23 Nov 2026"). */
export function keyValues(c: Cursor, pairs: Array<[string, string]>, opts: { size?: number; labelWidth?: number } = {}): void {
    const size = opts.size ?? 9
    const labelWidth = opts.labelWidth ?? 110
    const lh = lineHeight(size)
    for (const [label, value] of pairs) {
        const lines = wrapText(c.fonts.regular, value, size, c.contentWidth - labelWidth)
        c.ensure(lh * lines.length)
        c.page.drawText(fitOneLine(c.fonts.regular, label, size, labelWidth - 8), { x: c.left, y: c.y - size, size, font: c.fonts.regular, color: INK.muted })
        lines.forEach((line, i) => {
            c.page.drawText(line, { x: c.left + labelWidth, y: c.y - size - i * lh, size, font: c.fonts.regular, color: INK.text })
        })
        c.y -= lh * lines.length
    }
}

export interface Column {
    header: string
    /** Relative width share (any positive numbers; normalised). Default 1. */
    width?: number
    align?: 'left' | 'right' | 'center'
}

export interface TableOptions {
    size?: number
    /** Repeat the header row at the top of every page the table runs onto. Default true. */
    repeatHeader?: boolean
    headerFill?: RGB
    /** Shade every other row. Default false. */
    zebra?: boolean
    /** Cell padding in points. Default 4. */
    padding?: number
}

/**
 * A table: wrapped cells, a header row that repeats on every page, rows never split across pages (a row taller than a
 * page is drawn anyway and clipped by the page - keep cells short).
 */
export function table(c: Cursor, columns: Column[], rows: string[][], opts: TableOptions = {}): void {
    const size = opts.size ?? 9
    const pad = opts.padding ?? 4
    const lh = lineHeight(size)
    const shares = columns.map((col) => (col.width && col.width > 0 ? col.width : 1))
    const total = shares.reduce((a, b) => a + b, 0)
    const widths = shares.map((s) => (s / total) * c.contentWidth)
    const xs = widths.map((_, i) => c.left + widths.slice(0, i).reduce((a, b) => a + b, 0))

    const drawRow = (cells: string[], font: PDFFont, fill: RGB | null, color: RGB) => {
        const wrapped = columns.map((_, i) => wrapText(font, cells[i] ?? '', size, (widths[i] ?? 0) - pad * 2))
        const height = Math.max(1, ...wrapped.map((w) => w.length)) * lh + pad * 2
        return { wrapped, height, paint: (top: number) => {
            if (fill) c.page.drawRectangle({ x: c.left, y: top - height, width: c.contentWidth, height, color: fill })
            wrapped.forEach((lines, i) => {
                const col = columns[i]
                const x0 = xs[i] ?? c.left
                const w = widths[i] ?? 0
                lines.forEach((line, j) => {
                    const tw = font.widthOfTextAtSize(line, size)
                    const x = col?.align === 'right' ? x0 + w - pad - tw : col?.align === 'center' ? x0 + (w - tw) / 2 : x0 + pad
                    c.page.drawText(line, { x, y: top - pad - size - j * lh, size, font, color })
                })
            })
            c.page.drawLine({ start: { x: c.left, y: top - height }, end: { x: c.right, y: top - height }, thickness: 0.5, color: INK.rule })
        } }
    }

    const drawHeader = () => {
        const header = drawRow(columns.map((col) => col.header), c.fonts.bold, opts.headerFill ?? INK.panel, INK.text)
        c.ensure(header.height + lh + pad * 2)
        header.paint(c.y)
        c.y -= header.height
    }

    drawHeader()
    rows.forEach((cells, index) => {
        const row = drawRow(cells, c.fonts.regular, opts.zebra && index % 2 === 1 ? INK.panel : null, INK.text)
        if (c.ensure(row.height) && opts.repeatHeader !== false) drawHeader()
        row.paint(c.y)
        c.y -= row.height
    })
}

/**
 * Footer on every page: `text` on the left, "Page n of N" on the right. Call LAST, once every page exists.
 */
export function stampFooter(c: Cursor, text: string, opts: { size?: number } = {}): void {
    const size = opts.size ?? 8
    const pages = c.doc.getPages()
    const y = c.margins.bottom / 2
    pages.forEach((page, i) => {
        const label = `Page ${i + 1} of ${pages.length}`
        const lw = c.fonts.regular.widthOfTextAtSize(label, size)
        const { width } = page.getSize()
        const right = width - c.margins.right
        page.drawText(fitOneLine(c.fonts.regular, text, size, right - c.margins.left - lw - 16), {
            x: c.margins.left, y, size, font: c.fonts.regular, color: INK.faint,
        })
        page.drawText(label, { x: right - lw, y, size, font: c.fonts.regular, color: INK.faint })
    })
}
