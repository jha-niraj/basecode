// @repo/sarvamai - language codes. Sarvam speaks BCP-47 with an "-IN" region ("hi-IN", "od-IN"); browsers hand us
// "hi", "en-US" or ISO "or" for Odia. Normalise at the edge, once, with these.

export interface SarvamLanguage {
    code: string
    name: string
    /** Name in its own script. */
    nativeName: string
    /** Speech to text and text to speech (bulbul) support it. */
    speech: boolean
}

/** The 11 languages every Sarvam surface handles (speech, translate, detection). */
export const SARVAM_LANGUAGES: readonly SarvamLanguage[] = [
    { code: 'en-IN', name: 'English', nativeName: 'English', speech: true },
    { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', speech: true },
    { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা', speech: true },
    { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી', speech: true },
    { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', speech: true },
    { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം', speech: true },
    { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', speech: true },
    { code: 'od-IN', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', speech: true },
    { code: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', speech: true },
    { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', speech: true },
    { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', speech: true },
] as const

/** Extra source/target languages sarvam-translate:v1 accepts beyond the 11 above (text only). */
export const TRANSLATE_ONLY_LANGUAGES: readonly SarvamLanguage[] = [
    { code: 'as-IN', name: 'Assamese', nativeName: 'অসমীয়া', speech: false },
    { code: 'brx-IN', name: 'Bodo', nativeName: 'बड़ो', speech: false },
    { code: 'doi-IN', name: 'Dogri', nativeName: 'डोगरी', speech: false },
    { code: 'kok-IN', name: 'Konkani', nativeName: 'कोंकणी', speech: false },
    { code: 'ks-IN', name: 'Kashmiri', nativeName: 'کٲشُر', speech: false },
    { code: 'mai-IN', name: 'Maithili', nativeName: 'मैथिली', speech: false },
    { code: 'mni-IN', name: 'Manipuri', nativeName: 'মৈতৈলোন্', speech: false },
    { code: 'ne-IN', name: 'Nepali', nativeName: 'नेपाली', speech: false },
    { code: 'sa-IN', name: 'Sanskrit', nativeName: 'संस्कृतम्', speech: false },
    { code: 'sat-IN', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', speech: false },
    { code: 'sd-IN', name: 'Sindhi', nativeName: 'سنڌي', speech: false },
    { code: 'ur-IN', name: 'Urdu', nativeName: 'اردو', speech: false },
] as const

/** Every language code `translate` accepts. */
export const TRANSLATE_LANGUAGES: ReadonlySet<string> = new Set([
    ...SARVAM_LANGUAGES.map((l) => l.code),
    ...TRANSLATE_ONLY_LANGUAGES.map((l) => l.code),
])

/** The codes text to speech can voice. */
export const TTS_LANGUAGES: ReadonlySet<string> = new Set(SARVAM_LANGUAGES.filter((l) => l.speech).map((l) => l.code))

/** "hi", "hi-in", "HI-IN" -> "hi-IN"; "en-US" -> "en-IN"; "or" (ISO Odia) -> "od-IN". Null for "auto" / empty. */
export function normaliseLanguage(code: string | null | undefined): string | null {
    if (!code) return null
    const lower = code.trim().toLowerCase()
    if (!lower || lower === 'auto' || lower === 'unknown') return null
    let base = lower.split(/[-_]/)[0] ?? ''
    if (!base) return null
    if (base === 'or') base = 'od'
    return `${base}-IN`
}

/** The display name for a code, or the code itself. */
export function languageName(code: string): string {
    const n = normaliseLanguage(code)
    return [...SARVAM_LANGUAGES, ...TRANSLATE_ONLY_LANGUAGES].find((l) => l.code === n)?.name ?? code
}

const DEVANAGARI = /[ऀ-ॿ]/

/** True when the text carries Devanagari script (Hindi, Marathi, Nepali...). */
export function hasDevanagari(text: string): boolean {
    return DEVANAGARI.test(text)
}
