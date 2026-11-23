import localFont from "next/font/local"

/**
 * Geist, committed as woff2 and loaded with next/font/local - never next/font/google (a fonts.gstatic 404 failed a
 * deploy once). The globals map these variables onto Tailwind's `font-sans` / `font-mono`.
 */
export const geistSans = localFont({
    src: [{ path: "./fonts/GeistLatin.woff2", weight: "100 900", style: "normal" }],
    variable: "--font-geist-sans",
    display: "swap",
})

export const geistMono = localFont({
    src: [{ path: "./fonts/GeistMonoLatin.woff2", weight: "100 900", style: "normal" }],
    variable: "--font-geist-mono",
    display: "swap",
})
