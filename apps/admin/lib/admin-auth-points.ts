import { ScrollText, ShieldCheck, Users } from 'lucide-react'

/** The admin sign-in panel's three lines (AuthFrame `points`). */
export const ADMIN_POINTS = [
    { icon: Users, text: 'Invite your team and set what each person can open' },
    { icon: ShieldCheck, text: 'Users, access and system settings in one place' },
    { icon: ScrollText, text: 'Every change written to the audit log' },
] as const
