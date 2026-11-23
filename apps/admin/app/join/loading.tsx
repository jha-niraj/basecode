import { AuthFormSkeleton } from '@repo/auth/ui'
import { AdminAuthFrame } from '../_components/admin-auth-frame'

export default function Loading() {
    return (
        <AdminAuthFrame panelTitle="You were invited to the admin console." panelLine="Set a password and you are in.">
            <AuthFormSkeleton fields={3} />
        </AdminAuthFrame>
    )
}
