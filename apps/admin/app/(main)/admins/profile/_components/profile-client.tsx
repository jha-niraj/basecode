"use client"

import * as React from "react"
import { BadgeCheck, Eye, EyeOff, KeyRound, Lock, UserRound } from "lucide-react"
import { Button } from "@repo/ui/components/ui/button"
import { InlineLoader } from "@repo/ui/components/ui/inline-loader"
import { Input } from "@repo/ui/components/ui/input"
import { Label } from "@repo/ui/components/ui/label"
import { Page } from "@repo/ui/components/ui/page"
import { PanelRow, PanelRows, SectionPanel } from "@repo/ui/components/ui/section-panel"
import { toast } from "@repo/ui/components/ui/toast"
import { useUrlTab } from "@repo/ui/hooks/use-url-tab"
import { changeAdminPassword } from "@/actions/admin.action"
import { formatAdminRole, type AdminPermissions } from "@/lib/permissions"
import { formatDate, PersonAvatar, Pill, StatusDot } from "../../_components/admin-bits"
import { PermissionMatrix } from "../../_components/permission-matrix"

export interface ProfileData {
    userId: string
    name: string
    email: string
    image: string | null
    role: string
    status: string
    permissions: AdminPermissions
    createdAt: string | null
    lastLoginAt: string | null
}

const TABS = ["overview", "access", "security"] as const
type Tab = (typeof TABS)[number]

/**
 * The admin's own profile: details (the avatar is read-only here - it comes from the account), their access, and the
 * password change. Tabs on the right of the header, synced to `?tab=`.
 */
export function ProfileClient({ profile, initialTab }: { profile: ProfileData; initialTab?: string | string[] }) {
    const [tab, setTab] = useUrlTab(TABS, initialTab, "overview")
    const isSuper = profile.role === "SUPER_ADMIN"

    return (
        <Page
            title="Profile"
            description="Your admin account, your access and your password."
            icon={<UserRound />}
            tabs={[
                { value: "overview", label: "Overview", icon: <UserRound /> },
                { value: "access", label: "Access", icon: <BadgeCheck /> },
                { value: "security", label: "Security", icon: <Lock /> },
            ]}
            tab={tab}
            onTabChange={(v) => setTab(v as Tab)}
        >
            {tab === "overview" && (
                <SectionPanel title="Your account" description="Shown to other admins in the audit log and the team list.">
                    <div className="flex min-w-0 items-center gap-3 py-2">
                        <PersonAvatar name={profile.name} email={profile.email} image={profile.image} className="h-12 w-12" />
                        <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-neutral-900 dark:text-white">{profile.name || "No name"}</p>
                            <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{profile.email}</p>
                        </div>
                    </div>
                    <PanelRows>
                        <PanelRow label="Role"><Pill>{formatAdminRole(profile.role)}</Pill></PanelRow>
                        <PanelRow label="Status"><StatusDot status={profile.status} /></PanelRow>
                        <PanelRow label="Admin since">{formatDate(profile.createdAt)}</PanelRow>
                        <PanelRow label="Last sign-in">{profile.lastLoginAt ? formatDate(profile.lastLoginAt, true) : "Not recorded yet"}</PanelRow>
                        <PanelRow label="User ID" valueClassName="truncate font-mono text-xs text-neutral-600 dark:text-neutral-400">{profile.userId}</PanelRow>
                    </PanelRows>
                </SectionPanel>
            )}

            {tab === "access" && (
                <SectionPanel
                    title="Your access"
                    description={isSuper ? "A super admin has every permission." : "Set by a super admin on the Access page."}
                    variant="data"
                >
                    <PermissionMatrix value={profile.permissions} readOnly allGranted={isSuper} />
                </SectionPanel>
            )}

            {tab === "security" && <PasswordPanel />}
        </Page>
    )
}

function PasswordField({ id, label, value, onChange, placeholder, autoComplete }: {
    id: string
    label: string
    value: string
    onChange: (v: string) => void
    placeholder: string
    autoComplete: string
}) {
    const [shown, setShown] = React.useState(false)
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <div className="relative">
                <Input
                    id={id}
                    type={shown ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    className="rounded-xl pr-10"
                    required
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShown((s) => !s)}
                    aria-label={shown ? "Hide password" : "Show password"}
                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 cursor-pointer rounded-lg text-neutral-500"
                >
                    {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
            </div>
        </div>
    )
}

/** The password change - the same `changeAdminPassword(current, next)` call as before. */
function PasswordPanel() {
    const [pwd, setPwd] = React.useState({ current: "", next: "", confirm: "" })
    const [changing, setChanging] = React.useState(false)

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        if (!pwd.current || !pwd.next) return toast.error("Fill in every field")
        if (pwd.next.length < 8) return toast.error("Use at least 8 characters for the new password")
        if (pwd.next !== pwd.confirm) return toast.error("The new passwords don't match")
        setChanging(true)
        const res = await changeAdminPassword(pwd.current, pwd.next)
        setChanging(false)
        if (res.success) {
            toast.success("Password changed")
            setPwd({ current: "", next: "", confirm: "" })
        } else {
            toast.error(res.error || "Could not change the password")
        }
    }

    return (
        <SectionPanel title="Change password" description="You stay signed in here after the change.">
            <form onSubmit={submit} className="flex max-w-sm flex-col gap-4 py-2">
                <PasswordField id="pwd-current" label="Current password" value={pwd.current} onChange={(v) => setPwd((p) => ({ ...p, current: v }))} placeholder="Your current password" autoComplete="current-password" />
                <PasswordField id="pwd-new" label="New password" value={pwd.next} onChange={(v) => setPwd((p) => ({ ...p, next: v }))} placeholder="At least 8 characters" autoComplete="new-password" />
                <PasswordField id="pwd-confirm" label="Confirm new password" value={pwd.confirm} onChange={(v) => setPwd((p) => ({ ...p, confirm: v }))} placeholder="The new password again" autoComplete="new-password" />
                <Button type="submit" disabled={changing} className="w-fit cursor-pointer gap-2 rounded-xl">
                    {changing ? <InlineLoader size={14} label="Saving" /> : <KeyRound className="h-4 w-4" />}
                    Change password
                </Button>
            </form>
        </SectionPanel>
    )
}
