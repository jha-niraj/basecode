import type { Metadata, Viewport } from "next"
import "@repo/ui/styles/globals.css"
import "./editor.css"
import { SITE } from "@repo/core/site"
import { geistMono, geistSans } from "./fonts"
import { Providers } from "./providers"

export const metadata: Metadata = {
    title: { default: `${SITE.name} admin`, template: `%s | ${SITE.name} admin` },
    description: `The ${SITE.name} admin console - team, access, users, audit and system settings.`,
    robots: { index: false, follow: false },
}

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
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
