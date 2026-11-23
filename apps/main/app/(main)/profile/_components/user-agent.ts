export type DeviceKind = "phone" | "tablet" | "desktop"

const BROWSERS: [RegExp, string][] = [
    [/Edg(?:e|A|iOS)?\//, "Edge"],
    [/OPR\/|Opera/, "Opera"],
    [/SamsungBrowser\//, "Samsung Internet"],
    [/Firefox\/|FxiOS\//, "Firefox"],
    [/Chrome\/|CriOS\//, "Chrome"],
    [/Safari\//, "Safari"],
]

const SYSTEMS: [RegExp, string][] = [
    [/iPhone/, "iPhone"],
    [/iPad/, "iPad"],
    [/Android/, "Android"],
    [/CrOS/, "ChromeOS"],
    [/Windows/, "Windows"],
    [/Mac OS X|Macintosh/, "macOS"],
    [/Linux/, "Linux"],
]

/** "Chrome on macOS" and a device kind for the icon. */
export function parseUserAgent(ua: string | null | undefined): { label: string; kind: DeviceKind } {
    if (!ua) return { label: "Unknown device", kind: "desktop" }
    const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] ?? (/curl|node|undici|axios/i.test(ua) ? null : "Browser")
    const os = SYSTEMS.find(([re]) => re.test(ua))?.[1] ?? "an unknown system"
    const kind: DeviceKind = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet" : /Mobi|iPhone/.test(ua) ? "phone" : "desktop"
    return { label: browser ? `${browser} on ${os}` : "Other device", kind }
}

/** Loopback and zeroed addresses (local dev) say nothing, so they are hidden. */
export function displayIp(ip: string | null | undefined): string | null {
    const v = ip?.trim()
    if (!v || /^[0:.]+$/.test(v) || v === "::1" || v.startsWith("127.") || v === "::ffff:127.0.0.1") return null
    return v
}
