import { AuthFrame } from '@repo/auth/ui'
import { AUTH_ROUTES } from '@/lib/auth-routes'

/** One frame for every auth page; it stays mounted as the person moves between sign-in, sign-up and the rest. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthFrame
            links={{ signIn: AUTH_ROUTES.signIn, signUp: AUTH_ROUTES.signUp }}
            legal={{ terms: AUTH_ROUTES.terms, privacy: AUTH_ROUTES.privacy }}
        >
            {children}
        </AuthFrame>
    )
}
