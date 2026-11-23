/**
 * The email design kit: ONE neutral layout and a few blocks. Tables and inline styles only - that is what mail clients
 * render (no stylesheet, flexbox or grid survives Outlook). Every template composes these; none writes its own <html>.
 * The product name comes from SITE (@repo/core/site), never a literal.
 */
import { SITE } from '@repo/core/site'

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const INK = '#171717'
const INK_2 = '#404040'
const MUTED = '#525252'
const LINE = '#e5e5e5'
const GROUND = '#f5f5f5'

/** Escape every value that came from a person or the database before it goes into HTML. */
export function esc(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return ''
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/** Only http(s) and mailto links; anything else becomes `#`. */
export function escUrl(url: string | null | undefined): string {
    if (!url) return '#'
    const trimmed = String(url).trim()
    if (!/^(https?:|mailto:)/i.test(trimmed)) return '#'
    return esc(trimmed)
}

export function heading(text: string): string {
    return `<h1 style="margin:0 0 12px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:600;color:${INK};">${esc(text)}</h1>`
}

/** A paragraph. Pass already-escaped HTML (use `esc` on any value inside). */
export function paragraph(html: string): string {
    return `<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK_2};">${html}</p>`
}

export function button(label: string, href: string): string {
    return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 20px;">
  <tr><td style="border-radius:10px;background:${INK};">
    <a href="${escUrl(href)}" target="_blank" style="display:inline-block;padding:12px 22px;border-radius:10px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(label)}</a>
  </td></tr>
</table>`
}

/** The link under a button, for clients that block buttons. */
export function fallbackLink(href: string): string {
    return `<p style="margin:0 0 14px;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">Or open this link:<br /><a href="${escUrl(href)}" style="color:${INK_2};word-break:break-all;">${esc(href)}</a></p>`
}

/** A one-time code, large and spaced, easy to read and copy. */
export function codeBlock(code: string, note: string): string {
    return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 20px;">
  <tr><td align="center" style="padding:20px;border:1px solid ${LINE};border-radius:12px;background:${GROUND};">
    <div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;letter-spacing:8px;font-weight:600;color:${INK};">${esc(code)}</div>
    <div style="margin-top:8px;font-family:${FONT};font-size:12px;color:${MUTED};">${esc(note)}</div>
  </td></tr>
</table>`
}

/**
 * The shell: product name on top, the content in a white card, a footnote below.
 * @param preheader the grey preview line most inboxes show after the subject.
 * @param footnote one line on why this mail arrived ("If you didn't ask for this, ignore it.").
 */
export function layout({ preheader, body, footnote }: { preheader: string; body: string; footnote?: string }): string {
    const year = new Date().getFullYear()
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>${esc(SITE.name)}</title>
</head>
<body style="margin:0;padding:0;background:${GROUND};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${GROUND};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
      <tr><td style="padding:0 4px 16px;font-family:${FONT};font-size:15px;font-weight:600;color:${INK};">${esc(SITE.name)}</td></tr>
      <tr><td style="padding:28px 28px 14px;background:#ffffff;border:1px solid ${LINE};border-radius:14px;">${body}</td></tr>
      ${footnote ? `<tr><td style="padding:16px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">${esc(footnote)}</td></tr>` : ''}
      <tr><td style="padding:8px 4px 0;font-family:${FONT};font-size:12px;color:${MUTED};">&copy; ${year} ${esc(SITE.name)}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}
