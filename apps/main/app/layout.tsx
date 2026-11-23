import type { Metadata, Viewport } from "next"
import "@repo/ui/styles/globals.css"
import { SITE } from "@repo/core/site"
import { geistMono, geistSans } from "./fonts"
import { Providers } from "./providers"

export const metadata: Metadata = {
    metadataBase: new URL(SITE.url),
    title: { default: SITE.name, template: `%s | ${SITE.name}` },
    description: SITE.description,
    applicationName: SITE.name,
    alternates: { canonical: "/" },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: SITE.url,
        siteName: SITE.name,
        title: `${SITE.name} - ${SITE.tagline}`,
        description: SITE.description,
    },
    twitter: {
        card: "summary_large_image",
        title: `${SITE.name} - ${SITE.tagline}`,
        description: SITE.description,
    },
    robots: { index: true, follow: true },
}

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    // The phone tab bar pads itself by env(safe-area-inset-bottom); that needs viewport-fit=cover.
    viewportFit: "cover",
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#121314" },
    ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
            <body className="bg-white font-sans text-neutral-900 antialiased dark:bg-[#121314] dark:text-neutral-100">
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}
