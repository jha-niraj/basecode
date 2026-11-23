"use client"

import { createContext, useContext, useMemo } from "react"
import {
    adminCan,
    type AdminPermission,
    type AdminPermissions,
    type PermissionLevel,
} from "@/lib/permissions"

interface AdminAccessContextValue {
    adminRole: string | null
    permissions: AdminPermissions
    isSuperAdmin: boolean
    /** Kept for older call sites; the value is seeded by the server layout, so it is never loading. */
    loading: boolean
    /** Can the current admin do this on that module? */
    can: (module: AdminPermission, level?: PermissionLevel) => boolean
}

const AdminAccessContext = createContext<AdminAccessContextValue>({
    adminRole: null,
    permissions: {},
    isSuperAdmin: false,
    loading: false,
    can: () => false,
})

/**
 * The admin's role and permissions for client components. Seeded by the server layout (`getAdmin()`), so the first
 * frame already knows what to show - no effect, no fetch, no flash of a hidden button.
 */
export function AdminAccessProvider({ role, permissions, children }: {
    role: string
    permissions: AdminPermissions
    children: React.ReactNode
}) {
    const value = useMemo<AdminAccessContextValue>(() => ({
        adminRole: role,
        permissions,
        isSuperAdmin: role === "SUPER_ADMIN",
        loading: false,
        can: (module, level = "read") => adminCan({ role, permissions }, module, level),
    }), [role, permissions])
    return <AdminAccessContext.Provider value={value}>{children}</AdminAccessContext.Provider>
}

export function useAdminAccess() {
    return useContext(AdminAccessContext)
}
