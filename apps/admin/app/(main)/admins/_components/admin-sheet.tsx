"use client"

import * as React from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@repo/ui/components/ui/button"
import { ConfirmPopover } from "@repo/ui/components/ui/confirm-popover"
import { InlineLoader } from "@repo/ui/components/ui/inline-loader"
import { Label } from "@repo/ui/components/ui/label"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet"
import { toast } from "@repo/ui/components/ui/toast"
import { updateAdminPermissions, updateAdminStatus } from "@/actions/admin.action"
import { useAdminAccess } from "@/context/admin-access-context"
import { formatAdminRole, type AdminPermissions } from "@/lib/permissions"
import { ADMIN_STATUSES, formatAdminStatus, type AdminStatus, type AdminUser } from "@/types/admin"
import { ADMIN_KEYS, formatDate, PersonAvatar, Pill } from "./admin-bits"
import { PermissionMatrix } from "./permission-matrix"

/**
 * One admin, edited in the keep-open right sheet (status + permissions). Rows that open it carry
 * `data-sheet-keep-open`, so pressing another row swaps the sheet to that admin. The draft resets when the admin
 * changes; the parent clears its selection in `onExitComplete`, never while the sheet slides out.
 */
export function AdminSheet({ admin, open, onOpenChange, onExitComplete }: {
    admin: AdminUser | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onExitComplete?: () => void
}) {
    const queryClient = useQueryClient()
    const { isSuperAdmin } = useAdminAccess()
    const [status, setStatus] = React.useState<AdminStatus>("ACTIVE")
    const [permissions, setPermissions] = React.useState<AdminPermissions>({})

    // A new admin in the sheet (a swap) starts from that admin's saved values.
    const adminId = admin?.id
    React.useEffect(() => {
        if (!admin) return
        setStatus(admin.status)
        setPermissions(admin.permissions ?? {})
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adminId])

    const save = useMutation({
        mutationFn: async () => {
            if (!admin) return
            if (status !== admin.status) {
                const r = await updateAdminStatus(admin.id, status)
                if (!r.success) throw new Error(r.error ?? "Could not change the status")
            }
            if (admin.adminRole !== "SUPER_ADMIN" && JSON.stringify(permissions) !== JSON.stringify(admin.permissions ?? {})) {
                const normalised = Object.fromEntries(
                    Object.entries(permissions).map(([k, v]) => [k, Array.from(v ?? [])]),
                ) as Record<string, string[]>
                const r = await updateAdminPermissions(admin.id, normalised)
                if (!r.success) throw new Error(r.error ?? "Could not save the permissions")
            }
        },
        onSuccess: async () => {
            toast.success("Saved")
            await queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.all })
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
    })

    const dirty = !!admin && (status !== admin.status || JSON.stringify(permissions) !== JSON.stringify(admin.permissions ?? {}))
    const canEdit = isSuperAdmin
    const isSuper = admin?.adminRole === "SUPER_ADMIN"

    const saveButton = (
        <Button type="button" disabled={!dirty || save.isPending} onClick={status === "SUSPENDED" && admin?.status !== "SUSPENDED" ? undefined : () => save.mutate()} className="cursor-pointer gap-2 rounded-xl">
            {save.isPending ? <InlineLoader size={14} label="Saving" /> : null}
            Save changes
        </Button>
    )

    return (
        <Sheet open={open} onOpenChange={onOpenChange} onExitComplete={onExitComplete}>
            <SheetContent side="right" className="flex w-full flex-col gap-4">
                <SheetHeader>
                    <SheetTitle className="truncate">{admin?.name || admin?.email || "Admin"}</SheetTitle>
                    <SheetDescription className="truncate">{admin?.email}</SheetDescription>
                </SheetHeader>
                {admin ? (
                    <ScrollArea orientation="vertical" className="-mx-6 min-h-0 flex-1">
                        <div className="flex flex-col gap-4 px-6 pb-2">
                            <div className="flex items-center gap-3">
                                <PersonAvatar name={admin.name} email={admin.email} image={admin.image} className="h-10 w-10" />
                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                    <Pill>{formatAdminRole(admin.adminRole)}</Pill>
                                    <span className="text-xs text-neutral-500 dark:text-neutral-400">Last sign-in {formatDate(admin.lastLoginAt, true)}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="admin-status">Status</Label>
                                <Select value={status} onValueChange={(v) => setStatus(v as AdminStatus)} disabled={!canEdit}>
                                    <SelectTrigger id="admin-status" className="w-full cursor-pointer rounded-xl sm:w-60">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ADMIN_STATUSES.map((s) => (
                                            <SelectItem key={s} value={s} className="cursor-pointer">{formatAdminStatus(s)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    An inactive or suspended admin cannot sign in to the console.
                                </p>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Access</h3>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                    {isSuper ? "A super admin has every permission." : "What this admin can see and change."}
                                </p>
                                <PermissionMatrix
                                    value={permissions}
                                    onChange={canEdit && !isSuper ? setPermissions : undefined}
                                    readOnly={!canEdit}
                                    allGranted={isSuper}
                                />
                            </div>
                            {!canEdit && (
                                <p className="text-xs text-neutral-500 dark:text-neutral-400">Only a super admin can change status or access.</p>
                            )}
                        </div>
                    </ScrollArea>
                ) : null}
                {canEdit && admin ? (
                    <SheetFooter>
                        <Button type="button" variant="outline" className="cursor-pointer rounded-xl" onClick={() => onOpenChange(false)}>Close</Button>
                        {status === "SUSPENDED" && admin.status !== "SUSPENDED" ? (
                            <ConfirmPopover
                                title="Suspend this admin?"
                                description="They lose access to the console until an admin makes them active again."
                                confirmLabel="Suspend"
                                onConfirm={() => save.mutateAsync()}
                                disabled={!dirty || save.isPending}
                                side="top"
                            >
                                {saveButton}
                            </ConfirmPopover>
                        ) : saveButton}
                    </SheetFooter>
                ) : null}
            </SheetContent>
        </Sheet>
    )
}
