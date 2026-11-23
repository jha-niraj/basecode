"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@repo/ui/components/ui/button"
import { InlineLoader } from "@repo/ui/components/ui/inline-loader"
import { Input } from "@repo/ui/components/ui/input"
import { Label } from "@repo/ui/components/ui/label"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet"
import { toast } from "@repo/ui/components/ui/toast"
import { createAdminInvitation } from "@/actions/admin.action"
import { formatAdminRole, type AdminPermissions, type AdminRole } from "@/lib/permissions"
import { ADMIN_KEYS } from "./admin-bits"
import { PermissionMatrix } from "./permission-matrix"

const ROLES: AdminRole[] = ["TEAM_MEMBER", "SUPER_ADMIN"]

/**
 * Invite an admin: email, name, role and (for a team member) the starting access. The form wraps the scroller and the
 * footer, so Save never scrolls away. Values reset in `onExitComplete`, after the slide-out.
 */
export function InviteSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const queryClient = useQueryClient()
    const [email, setEmail] = React.useState("")
    const [name, setName] = React.useState("")
    const [role, setRole] = React.useState<AdminRole>("TEAM_MEMBER")
    const [permissions, setPermissions] = React.useState<AdminPermissions>({})

    const reset = () => { setEmail(""); setName(""); setRole("TEAM_MEMBER"); setPermissions({}) }

    const invite = useMutation({
        mutationFn: async () => {
            const res = await createAdminInvitation({
                email: email.trim().toLowerCase(),
                name: name.trim() || undefined,
                adminRole: role,
                permissions: role === "SUPER_ADMIN"
                    ? {}
                    : Object.fromEntries(Object.entries(permissions).map(([k, v]) => [k, Array.from(v ?? [])])) as Record<string, string[]>,
            })
            if (!res.success) throw new Error(res.error ?? "Could not send the invitation")
            return res.data
        },
        onSuccess: async () => {
            toast.success("Invitation sent", { description: `${email.trim()} gets a link to join.` })
            await queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.all })
            onOpenChange(false)
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not send the invitation"),
    })

    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

    return (
        <Sheet open={open} onOpenChange={onOpenChange} onExitComplete={reset}>
            <SheetContent side="right" className="flex w-full flex-col gap-4">
                <SheetHeader>
                    <SheetTitle>Invite an admin</SheetTitle>
                    <SheetDescription>They get an email with a link to set a password and join.</SheetDescription>
                </SheetHeader>
                <form
                    className="flex min-h-0 flex-1 flex-col gap-4"
                    onSubmit={(e) => { e.preventDefault(); if (valid && !invite.isPending) invite.mutate() }}
                >
                    <ScrollArea orientation="vertical" className="-mx-6 min-h-0 flex-1">
                        <div className="flex flex-col gap-4 px-6 pb-2">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="invite-email">Email</Label>
                                <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="rounded-xl" required />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="invite-name">Name (optional)</Label>
                                <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Their full name" className="rounded-xl" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="invite-role">Role</Label>
                                <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
                                    <SelectTrigger id="invite-role" className="w-full cursor-pointer rounded-xl sm:w-60"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ROLES.map((r) => <SelectItem key={r} value={r} className="cursor-pointer">{formatAdminRole(r)}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Access</h3>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    {role === "SUPER_ADMIN" ? "A super admin has every permission." : "What they can see and change once they join. You can change it later."}
                                </p>
                                <PermissionMatrix
                                    value={permissions}
                                    onChange={role === "SUPER_ADMIN" ? undefined : setPermissions}
                                    allGranted={role === "SUPER_ADMIN"}
                                />
                            </div>
                        </div>
                    </ScrollArea>
                    <SheetFooter>
                        <Button type="button" variant="outline" className="cursor-pointer rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={!valid || invite.isPending} className="cursor-pointer gap-2 rounded-xl">
                            {invite.isPending ? <InlineLoader size={14} label="Sending" /> : null}
                            Send invitation
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    )
}
