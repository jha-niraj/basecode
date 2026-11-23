"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { UserCheck, UserX } from "lucide-react"
import { PanelRow, PanelRows } from "@repo/ui/components/ui/section-panel"
import { Button } from "@repo/ui/components/ui/button"
import { ConfirmPopover } from "@repo/ui/components/ui/confirm-popover"
import { InlineLoader } from "@repo/ui/components/ui/inline-loader"
import { ScrollArea } from "@repo/ui/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@repo/ui/components/ui/sheet"
import { Skeleton } from "@repo/ui/components/ui/skeleton"
import { toast } from "@repo/ui/components/ui/toast"
import { getUserById, updateUserStatus } from "@/actions/user.action"
import { useAdminAccess } from "@/context/admin-access-context"
import { formatAdminRole } from "@/lib/permissions"
import type { UserDetail, UserRow } from "@/types/admin"
import { formatDate, PersonAvatar, Pill } from "../../admins/_components/admin-bits"
import { USER_KEYS } from "./users-query"

async function fetchDetail(id: string): Promise<UserDetail> {
    const r = await getUserById(id)
    if (!r.success || !r.data) throw new Error(r.error ?? "Could not load the user")
    return r.data
}

/**
 * One user in the keep-open right sheet. It opens at once with the row's own fields and fills the rest (bio, admin
 * access, updated) when the detail read lands. Pressing another row swaps it (the grid carries `data-sheet-keep-open`).
 */
export function UserSheet({ row, open, onOpenChange, onExitComplete }: {
    row: UserRow | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onExitComplete?: () => void
}) {
    const queryClient = useQueryClient()
    const { can } = useAdminAccess()
    const canWrite = can("users", "write")

    const detail = useQuery({
        queryKey: USER_KEYS.detail(row?.id ?? ""),
        queryFn: () => fetchDetail(row!.id),
        enabled: !!row && open,
    })

    const setActive = useMutation({
        mutationFn: async (isActive: boolean) => {
            if (!row) return
            const r = await updateUserStatus(row.id, isActive)
            if (!r.success) throw new Error(r.error ?? "Could not change the status")
        },
        onSuccess: async (_d, isActive) => {
            toast.success(isActive ? "User activated" : "User deactivated")
            await queryClient.invalidateQueries({ queryKey: USER_KEYS.all })
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not change the status"),
    })

    const user = detail.data ?? row
    const isActive = detail.data?.isActive ?? row?.isActive ?? true

    return (
        <Sheet open={open} onOpenChange={onOpenChange} onExitComplete={onExitComplete}>
            <SheetContent side="right" className="flex w-full flex-col gap-4">
                <SheetHeader>
                    <SheetTitle className="truncate">{user?.name || user?.email || "User"}</SheetTitle>
                    <SheetDescription className="truncate">{user?.email}</SheetDescription>
                </SheetHeader>
                {user ? (
                    <ScrollArea orientation="vertical" className="-mx-6 min-h-0 flex-1">
                        <div className="flex flex-col gap-4 px-6 pb-2">
                            <div className="flex min-w-0 items-center gap-3">
                                <PersonAvatar name={user.name} email={user.email} image={user.image} className="h-12 w-12" />
                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                    <Pill>{user.role === "ADMIN" ? "Admin" : "User"}</Pill>
                                    <Pill>{isActive ? "Active" : "Inactive"}</Pill>
                                    <Pill>{user.emailVerified ? "Email verified" : "Email not verified"}</Pill>
                                </div>
                            </div>
                            <PanelRows>
                                <PanelRow label="Joined">{formatDate(user.createdAt, true)}</PanelRow>
                                <PanelRow label="Last updated">
                                    {detail.data ? formatDate(detail.data.updatedAt, true) : <Skeleton className="h-4 w-32" />}
                                </PanelRow>
                                <PanelRow label="Admin access">
                                    {detail.data
                                        ? (detail.data.adminAccess ? `${formatAdminRole(detail.data.adminAccess.adminRole)} (${detail.data.adminAccess.status.toLowerCase()})` : "None")
                                        : <Skeleton className="h-4 w-24" />}
                                </PanelRow>
                                <PanelRow label="User ID" valueClassName="truncate font-mono text-xs text-neutral-600 dark:text-neutral-400">{user.id}</PanelRow>
                            </PanelRows>
                            {detail.data?.bio ? (
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Bio</h3>
                                    <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">{detail.data.bio}</p>
                                </div>
                            ) : null}
                            {detail.isError ? (
                                <p className="text-xs text-neutral-600 dark:text-neutral-400">Some details could not be loaded. Close and open the user again.</p>
                            ) : null}
                        </div>
                    </ScrollArea>
                ) : null}
                {user && canWrite ? (
                    <SheetFooter>
                        <Button type="button" variant="outline" className="cursor-pointer rounded-xl" onClick={() => onOpenChange(false)}>Close</Button>
                        {isActive ? (
                            <ConfirmPopover
                                title="Deactivate this user?"
                                description="Their account is marked inactive until someone activates it again."
                                confirmLabel="Deactivate"
                                side="top"
                                onConfirm={() => setActive.mutateAsync(false)}
                            >
                                <Button type="button" variant="outline" disabled={setActive.isPending} className="cursor-pointer gap-2 rounded-xl">
                                    {setActive.isPending ? <InlineLoader size={14} label="Saving" /> : <UserX className="h-4 w-4" />}
                                    Deactivate
                                </Button>
                            </ConfirmPopover>
                        ) : (
                            <Button type="button" disabled={setActive.isPending} onClick={() => setActive.mutate(true)} className="cursor-pointer gap-2 rounded-xl">
                                {setActive.isPending ? <InlineLoader size={14} label="Saving" /> : <UserCheck className="h-4 w-4" />}
                                Activate
                            </Button>
                        )}
                    </SheetFooter>
                ) : null}
            </SheetContent>
        </Sheet>
    )
}
