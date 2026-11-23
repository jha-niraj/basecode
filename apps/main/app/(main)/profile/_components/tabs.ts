export const PROFILE_TABS = [
    { value: 'profile', label: 'Profile' },
    { value: 'security', label: 'Security' },
    { value: 'sessions', label: 'Sessions' },
    { value: 'account', label: 'Account' },
] as const

export type ProfileTab = (typeof PROFILE_TABS)[number]['value']
