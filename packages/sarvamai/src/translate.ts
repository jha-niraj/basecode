// @repo/sarvamai - text translation (sarvam-translate:v1) and language detection (text-lid) over fetch.
import { AppError } from '@repo/errors'
import { normaliseLanguage, TRANSLATE_LANGUAGES } from './languages'
import { SARVAM_BASE, sarvamFetch, sarvamHttpError, sarvamKey, type SarvamAuth } from './shared'

export const TRANSLATE_MODEL = 'sarvam-translate:v1'
/** sarvam-translate:v1 takes up to 2,000 characters per request. */
export const TRANSLATE_MAX_CHARS = 2000

export interface TranslateInput extends SarvamAuth {
    text: string
    /** BCP-47 target, e.g. "en-IN". */
    targetLanguage: string
    /** BCP-47 source; omit (or "auto") to let Sarvam detect it. */
    sourceLanguage?: string
    mode?: 'formal' | 'modern-colloquial' | 'classic-colloquial' | 'code-mixed'
    timeoutMs?: number
}

export interface TranslateResult {
    text: string
    sourceLanguage: string | null
    targetLanguage: string
}

/** Translate text (longer input is translated in sentence-sized chunks, in order). Throws AppError on failure. */
export async function translate(input: TranslateInput): Promise<TranslateResult> {
    const apiKey = sarvamKey(input)
    const target = normaliseLanguage(input.targetLanguage)
    if (!target || !TRANSLATE_LANGUAGES.has(target)) {
        throw new AppError('validation', `Translation into ${input.targetLanguage} is not supported.`)
    }
    const source = normaliseLanguage(input.sourceLanguage) ?? 'auto'
    if (source !== 'auto' && !TRANSLATE_LANGUAGES.has(source)) {
        throw new AppError('validation', `Translation from ${input.sourceLanguage} is not supported.`)
    }
    const text = input.text.trim()
    if (!text) return { text: '', sourceLanguage: source === 'auto' ? null : source, targetLanguage: target }
    if (source === target) return { text, sourceLanguage: source, targetLanguage: target }

    const out: string[] = []
    let detected: string | null = source === 'auto' ? null : source
    for (const chunk of chunkText(text, TRANSLATE_MAX_CHARS)) {
        const res = await sarvamFetch(
            `${SARVAM_BASE}/translate`,
            {
                method: 'POST',
                headers: { 'api-subscription-key': apiKey, 'content-type': 'application/json' },
                body: JSON.stringify({
                    input: chunk,
                    source_language_code: source,
                    target_language_code: target,
                    model: TRANSLATE_MODEL,
                    mode: input.mode ?? 'formal',
                }),
            },
            'translation',
            input.timeoutMs ?? 20_000,
        )
        if (!res.ok) throw await sarvamHttpError(res, 'translation')
        const json = (await res.json()) as { translated_text?: string; source_language_code?: string | null }
        out.push((json.translated_text ?? '').trim())
        detected = detected ?? json.source_language_code ?? null
    }
    return { text: out.join(' '), sourceLanguage: detected, targetLanguage: target }
}

/** Split at sentence ends so each part fits `max`; a single over-long sentence is cut at a space. */
function chunkText(text: string, max: number): string[] {
    if (text.length <= max) return [text]
    const sentences = text.match(/[^.!?।\n]+[.!?।\n]*/g) ?? [text]
    const chunks: string[] = []
    let current = ''
    for (const s of sentences) {
        if ((current + s).length > max && current) { chunks.push(current.trim()); current = '' }
        let rest = s
        while (rest.length > max) {
            const cut = rest.lastIndexOf(' ', max) > max / 2 ? rest.lastIndexOf(' ', max) : max
            chunks.push(rest.slice(0, cut).trim())
            rest = rest.slice(cut)
        }
        current += rest
    }
    if (current.trim()) chunks.push(current.trim())
    return chunks
}

export interface DetectLanguageResult {
    /** BCP-47, e.g. "hi-IN"; null when Sarvam could not tell. */
    languageCode: string | null
    /** ISO 15924 script, e.g. "Deva", "Latn". */
    scriptCode: string | null
}

/** Identify the language and script of a piece of text (the 11 core languages). Throws AppError on failure. */
export async function detectLanguage(text: string, auth?: SarvamAuth & { timeoutMs?: number }): Promise<DetectLanguageResult> {
    const apiKey = sarvamKey(auth)
    const input = text.trim().slice(0, 1000)
    if (!input) return { languageCode: null, scriptCode: null }
    const res = await sarvamFetch(
        `${SARVAM_BASE}/text-lid`,
        {
            method: 'POST',
            headers: { 'api-subscription-key': apiKey, 'content-type': 'application/json' },
            body: JSON.stringify({ input }),
        },
        'language detection',
        auth?.timeoutMs ?? 10_000,
    )
    if (!res.ok) throw await sarvamHttpError(res, 'language detection')
    const json = (await res.json()) as { language_code?: string | null; script_code?: string | null }
    return { languageCode: json.language_code ?? null, scriptCode: json.script_code ?? null }
}
