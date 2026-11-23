// @repo/pdf - fonts. Standard faces are WinAnsi only; anything else (₹, Devanagari, CJK) needs a Unicode TTF/OTF
// embedded through fontkit, SUBSET (only drawn glyphs are embedded - a page is ~7 KB instead of ~100 KB).
//
// Font bytes are FETCHED, not bundled: a Unicode face is 100 KB-1 MB per weight and a Worker has a hard size limit.
// Point the package at TTF/OTF files once (`setPdfFontSource`, e.g. from R2 or a static asset URL); the promise is
// cached per isolate, so concurrent renders make one request. Pick a face that covers Latin AND every currency sign
// the product prints (Noto Sans and Inter carry ₹ € £ ¥ ₨). Never woff2 - fontkit 1.x cannot subset it.
//
// No source configured, or a font that fails to load or shape, is SUPPORTED: documents fall back to Helvetica with
// `safeText` (₹ prints "Rs", unknown glyphs "?"). A missing font never fails a document.
import './regenerator-shim'
import fontkit from '@pdf-lib/fontkit'
import { StandardFonts, type PDFDocument, type PDFFont } from 'pdf-lib'

export interface PdfFontSource {
    regular: () => Promise<Uint8Array>
    bold: () => Promise<Uint8Array>
}

export interface Fonts {
    regular: PDFFont
    bold: PDFFont
    /** True when a Unicode face is embedded; false = Helvetica + safeText. */
    unicode: boolean
}

let source: PdfFontSource | null = null
let bytesPromise: Promise<{ regular: Uint8Array; bold: Uint8Array } | null> | null = null
let broken = false

/** Configure the Unicode font once at startup (or pass `null` to use Helvetica). */
export function setPdfFontSource(next: PdfFontSource | null): void {
    source = next
    bytesPromise = null
    broken = false
}

/** A font source that fetches two TTF/OTF URLs (a static asset, a public R2 object, a signed URL builder). */
export function fontSourceFromUrls(regularUrl: string | (() => Promise<string>), boldUrl: string | (() => Promise<string>)): PdfFontSource {
    const get = async (u: string | (() => Promise<string>)): Promise<Uint8Array> => {
        const url = typeof u === 'string' ? u : await u()
        const res = await fetch(url)
        if (!res.ok) throw new Error(`font fetch failed (${res.status})`)
        return new Uint8Array(await res.arrayBuffer())
    }
    return { regular: () => get(regularUrl), bold: () => get(boldUrl) }
}

async function loadBytes(): Promise<{ regular: Uint8Array; bold: Uint8Array } | null> {
    if (!source) return null
    if (!bytesPromise) {
        const src = source
        bytesPromise = Promise.all([src.regular(), src.bold()])
            .then(([regular, bold]) => ({ regular, bold }))
            .catch((err: unknown) => {
                console.error('[pdf] font fetch failed, falling back to Helvetica', err)
                return null
            })
    }
    return bytesPromise
}

/** Glyphs WinAnsi carries beyond Latin-1 (curly quotes, dashes, ellipsis, euro...). */
const WINANSI_EXTRAS = new Set([
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018,
    0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
])

/** Currency signs WinAnsi lacks, spelled out so a fallback document still reads right. */
const CURRENCY_FALLBACK: Record<string, string> = { '₹': 'Rs ', '₨': 'Rs ', 'रू': 'Rs ', '₩': 'KRW ', '₦': 'NGN ', '₱': 'PHP ', '₺': 'TRY ', '₫': 'VND ', '₽': 'RUB ', '₪': 'ILS ', '৳': 'Tk ' }
const CURRENCY_RE = new RegExp(Object.keys(CURRENCY_FALLBACK).join('|'), 'g')

/** Make a string drawable by a WinAnsi standard font. Fallback path only. */
export function safeText(text: string): string {
    // eslint-disable-next-line no-control-regex
    if (/^[\x00-\x7F]*$/.test(text)) return text
    const spelled = text.replace(CURRENCY_RE, (m) => CURRENCY_FALLBACK[m] ?? '?')
    const folded = spelled.normalize('NFKD').replace(/\p{M}/gu, '')
    let out = ''
    for (const ch of folded) {
        const code = ch.codePointAt(0) ?? 0
        out += code <= 0xff || WINANSI_EXTRAS.has(code) ? ch : '?'
    }
    return out
}

/** Wrap a standard font so every string is sanitised on the way to the encoder - and measured the SAME way. */
function guard(font: PDFFont): PDFFont {
    return new Proxy(font, {
        get(target, prop, receiver) {
            if (prop === 'encodeText') return (t: string) => target.encodeText(safeText(t))
            if (prop === 'widthOfTextAtSize') return (t: string, size: number) => target.widthOfTextAtSize(safeText(t), size)
            const value: unknown = Reflect.get(target, prop, receiver)
            return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
        },
    })
}

/** A probe with Latin, a currency sign and digits - shaping is lazy, so force it before trusting the font. */
const PROBE = 'Total ₹ 1,234.50 - €£'

/** Embed the fonts for one document: the configured Unicode face (subset), or guarded Helvetica. */
export async function loadFonts(doc: PDFDocument): Promise<Fonts> {
    const bytes = broken ? null : await loadBytes()
    if (bytes) {
        try {
            doc.registerFontkit(fontkit)
            const [regular, bold] = await Promise.all([
                doc.embedFont(bytes.regular, { subset: true }),
                doc.embedFont(bytes.bold, { subset: true }),
            ])
            regular.encodeText(PROBE)
            bold.encodeText(PROBE)
            return { regular, bold, unicode: true }
        } catch (err) {
            broken = true
            console.error('[pdf] font unusable, falling back to Helvetica', err)
        }
    }
    return {
        regular: guard(await doc.embedFont(StandardFonts.Helvetica)),
        bold: guard(await doc.embedFont(StandardFonts.HelveticaBold)),
        unicode: false,
    }
}
