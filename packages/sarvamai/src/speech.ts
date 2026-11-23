// @repo/sarvamai - speech to text (saaras) and text to speech (bulbul) over fetch.
import { AppError } from '@repo/errors'
import { hasDevanagari, normaliseLanguage, TTS_LANGUAGES } from './languages'
import {
    base64ToBytes, bytesToBase64, SARVAM_BASE, sarvamFetch, sarvamHttpError, sarvamKey, sleep, type SarvamAuth,
} from './shared'

export const STT_MODEL = 'saaras:v4'
export const TTS_MODEL = 'bulbul:v3'
/** Sarvam's REST speech-to-text ceiling: 30 seconds of audio per request; longer clips need the batch API. */
export const STT_MAX_SECONDS = 30
/** Sarvam's per-request text-to-speech ceiling. */
export const TTS_MAX_CHARS = 2500

// ─── Speech to text ──────────────────────────────────────────────────────────

/**
 * transcribe: same language, normalised. translate: always English. verbatim: word for word.
 * translit: Roman script. codemix: English words in Latin, Indic words in their own script.
 */
export type SpeechToTextMode = 'transcribe' | 'translate' | 'verbatim' | 'translit' | 'codemix'

export interface SpeechToTextInput extends SarvamAuth {
    /** The clip. A Blob/File keeps its own type and name unless overridden. */
    audio: Blob | Uint8Array
    mimeType?: string
    fileName?: string
    mode?: SpeechToTextMode
    /** BCP-47 ("hi-IN"). Omit and Sarvam detects the language. */
    languageCode?: string
    /** Override the model (e.g. a newer saaras). */
    model?: string
    timeoutMs?: number
}

export interface SpeechToTextResult {
    transcript: string
    /** The language Sarvam heard, e.g. "hi-IN"; null when it did not say. */
    languageCode: string | null
}

function extForType(type: string): string {
    if (/mp4|aac|m4a/.test(type)) return 'mp4'
    if (type.includes('wav')) return 'wav'
    if (type.includes('ogg')) return 'ogg'
    if (/mpeg|mp3/.test(type)) return 'mp3'
    return 'webm'
}

/** Transcribe one clip (at most 30 s). Throws AppError on failure (validation / ratelimit / quota / network). */
export async function speechToText(input: SpeechToTextInput): Promise<SpeechToTextResult> {
    const apiKey = sarvamKey(input)
    const isBlob = typeof Blob !== 'undefined' && input.audio instanceof Blob
    const bytes = isBlob ? new Uint8Array(await (input.audio as Blob).arrayBuffer()) : (input.audio as Uint8Array)
    if (bytes.length === 0) throw new AppError('validation', 'No audio was recorded.')

    // Sarvam rejects a parameterised type ("audio/webm;codecs=opus").
    const rawType = input.mimeType || (isBlob ? (input.audio as Blob).type : '') || 'audio/webm'
    const type = rawType.split(';')[0]?.trim() || 'audio/webm'
    const blobName = isBlob && 'name' in input.audio ? String((input.audio as File).name || '') : ''
    const fileName = input.fileName || blobName || `speech.${extForType(type)}`

    const form = new FormData()
    // A named part with a content type: Sarvam sniffs the codec from them. .slice() copies into a plain ArrayBuffer.
    form.append('file', new Blob([bytes.slice().buffer as ArrayBuffer], { type }), fileName)
    form.append('model', input.model ?? STT_MODEL)
    form.append('mode', input.mode ?? 'transcribe')
    if (input.languageCode) form.append('language_code', normaliseLanguage(input.languageCode) ?? input.languageCode)

    // No explicit Content-Type: fetch sets the multipart boundary.
    const res = await sarvamFetch(
        `${SARVAM_BASE}/speech-to-text`,
        { method: 'POST', headers: { 'api-subscription-key': apiKey }, body: form },
        'transcription',
        input.timeoutMs ?? 30_000,
    )
    if (!res.ok) throw await sarvamHttpError(res, 'transcription')
    const data = (await res.json().catch(() => ({}))) as { transcript?: string; language_code?: string | null }
    return { transcript: (data.transcript ?? '').trim(), languageCode: data.language_code ?? null }
}

// ─── Text to speech ──────────────────────────────────────────────────────────

export interface TextToSpeechInput extends SarvamAuth {
    text: string
    /** Defaults to hi-IN for Devanagari text, en-IN otherwise. */
    languageCode?: string
    /** Voice name for the model (e.g. "shubh", "priya" on bulbul:v3). Omit for the model's default voice. */
    speaker?: string
    model?: string
    pace?: number
    /** Hz. Omit for Sarvam's default. */
    sampleRate?: number
    /** Retries on 429 / 5xx with a growing pause. Default 0 - a request path should fail fast. */
    retries?: number
    timeoutMs?: number
}

export interface TextToSpeechResult {
    /** MP3 bytes. */
    audio: Uint8Array
    /** The same MP3 as standard base64 (what a JSON response carries). */
    audioBase64: string
    contentType: 'audio/mpeg'
    /** What Sarvam bills: characters spoken. */
    characters: number
}

/** Cut at the last sentence end before the limit (or the last space), never mid-word. */
export function truncateAtSentence(text: string, max: number = TTS_MAX_CHARS): string {
    const trimmed = text.trim()
    if (trimmed.length <= max) return trimmed
    const window = trimmed.slice(0, max)
    const end = Math.max(window.lastIndexOf('. '), window.lastIndexOf('! '), window.lastIndexOf('? '), window.lastIndexOf('।'), window.lastIndexOf('\n'))
    if (end >= max / 2) return window.slice(0, end + 1).trim()
    const space = window.lastIndexOf(' ')
    return (space >= max / 2 ? window.slice(0, space) : window).trim()
}

/** One finished MP3 clip (up to 2,500 characters; longer text is cut at a sentence). Throws AppError on failure. */
export async function textToSpeech(input: TextToSpeechInput): Promise<TextToSpeechResult> {
    const apiKey = sarvamKey(input)
    const text = truncateAtSentence(input.text.replace(/\s+/g, ' '))
    if (!text) throw new AppError('validation', 'There is nothing to say.')
    const requested = normaliseLanguage(input.languageCode)
    const language = requested && TTS_LANGUAGES.has(requested) ? requested : hasDevanagari(text) ? 'hi-IN' : 'en-IN'
    const body = JSON.stringify({
        text,
        language_code: language,
        model: input.model ?? TTS_MODEL,
        ...(input.speaker ? { speaker: input.speaker } : {}),
        ...(input.pace != null ? { pace: input.pace } : {}),
        ...(input.sampleRate != null ? { speech_sample_rate: input.sampleRate } : {}),
        output_audio_codec: 'mp3',
    })

    const attempts = 1 + Math.max(0, input.retries ?? 0)
    let lastError: AppError | null = null
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt) await sleep(2500 * attempt)
        const res = await sarvamFetch(
            `${SARVAM_BASE}/text-to-speech`,
            { method: 'POST', headers: { 'api-subscription-key': apiKey, 'content-type': 'application/json' }, body },
            'speech',
            input.timeoutMs ?? 60_000,
        )
        if (res.ok) {
            const json = (await res.json().catch(() => ({}))) as { audios?: string[] }
            const audios = json.audios ?? []
            const parts = audios.map(base64ToBytes)
            const audio = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
            let at = 0
            for (const p of parts) { audio.set(p, at); at += p.length }
            if (!audio.length) throw new AppError('network', 'The speech service returned no audio.')
            const audioBase64 = audios.length === 1 && audios[0] ? audios[0] : bytesToBase64(audio)
            return { audio, audioBase64, contentType: 'audio/mpeg', characters: text.length }
        }
        lastError = await sarvamHttpError(res, 'speech')
        if (res.status !== 429 && res.status < 500) break
    }
    throw lastError ?? new AppError('network', 'The speech service failed - try again.')
}
