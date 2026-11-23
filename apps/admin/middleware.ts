import { NextResponse, type NextRequest } from 'next/server'
import { isSignedIn, matchesRoute, sessionCookieNames, signInRedirectUrl, signedInRedirectUrl } from '@repo/auth/middleware'

/**
 * Cookie-only (packages/auth/src/middleware.ts): never the database. Stays `middleware.ts` - OpenNext rejects Next 16's
 * Node `proxy.ts`. Admin access itself (adminAccess row, status, permissions) is checked by the (main) layout and every
 * action; this only sends a visitor with no session cookie to the sign-in page.
 */
const SIGN_IN = '/'
const HOME = '/home'

/** The sign-in page (`/`) and the invitation page: a signed-in visitor goes on to HOME (or their returnTo). */
const AUTH_ONLY = ['/', '/join']

export function middleware(request: NextRequest) {
    const { pathname, searchParams } = request.nextUrl

    // `/signin` is main's name for the page; better-auth's error redirect and old links may use it here too.
    if (pathname === '/signin') {
        const url = request.nextUrl.clone()
        url.pathname = SIGN_IN
        return NextResponse.redirect(url)
    }

    const signedIn = isSignedIn(request)

    if (matchesRoute(pathname, AUTH_ONLY)) {
        if (!signedIn) return NextResponse.next()
        // `?stale=1`: the page found the cookie dead. Expire it here, or HOME and the sign-in page would loop.
        // `?denied=1`: signed in, but not an active admin - sign them out here too so another account can sign in.
        if (searchParams.has('stale') || searchParams.has('denied')) return expireSessionCookies(NextResponse.next())
        return NextResponse.redirect(signedInRedirectUrl(request, HOME))
    }

    if (!signedIn) return NextResponse.redirect(signInRedirectUrl(request, SIGN_IN))
    return NextResponse.next()
}

function expireSessionCookies(res: NextResponse): NextResponse {
    const [plain, secure] = sessionCookieNames()
    res.cookies.set(plain, '', { path: '/', maxAge: 0 })
    res.cookies.set(secure, '', { path: '/', maxAge: 0, secure: true })
    return res
}

export const config = {
    matcher: ['/((?!api/|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
}
