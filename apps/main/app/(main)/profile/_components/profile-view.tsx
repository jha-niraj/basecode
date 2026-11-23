"use client"

import * as React from "react"
import { Page } from "@repo/ui/components/ui/page"
import type { ProfileData, ProfileSessionRow } from "@/types/profile"
import { PROFILE_TABS, type ProfileTab } from "./tabs"
import { ProfileTabPanel } from "./profile-tab"
import { SecurityTabPanel } from "./security-tab"
import { SessionsTabPanel } from "./sessions-tab"
import { AccountTabPanel } from "./account-tab"

/**
 * Profile | Security | Sessions | Account, tabs on the right of the header and synced to `?tab=` with
 * `history.replaceState` - every tab's data is already here, so switching never re-renders the page on the server.
 */
export function ProfileView({ initialTab, profile, sessions }: {
    initialTab: ProfileTab
    profile: ProfileData
    sessions: ProfileSessionRow[] | null
}) {
    const [tab, setTab] = React.useState<ProfileTab>(initialTab)

    const onTabChange = React.useCallback((value: string) => {
        const next = PROFILE_TABS.find((t) => t.value === value)?.value ?? "profile"
        setTab(next)
        const url = new URL(window.location.href)
        if (next === "profile") url.searchParams.delete("tab")
        else url.searchParams.set("tab", next)
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
    }, [])

    return (
        <Page
            title="Profile"
            width="reading"
            description="Your details, password, devices and account."
            tabs={PROFILE_TABS.map((t) => ({ value: t.value, label: t.label }))}
            tab={tab}
            onTabChange={onTabChange}
        >
            <div className="flex w-full flex-col gap-3">
                {tab === "profile" && <ProfileTabPanel profile={profile} />}
                {tab === "security" && <SecurityTabPanel hasPassword={profile.hasPassword} providers={profile.providers} />}
                {tab === "sessions" && <SessionsTabPanel sessions={sessions} />}
                {tab === "account" && <AccountTabPanel email={profile.email} createdAt={profile.createdAt} />}
            </div>
        </Page>
    )
}
