import { redirect } from "next/navigation"
import { ROUTES } from "@/lib/navigation"

/** `/settings` has no page of its own: the first section. */
export default function SettingsIndex() {
    redirect(ROUTES.settingsNotifications)
}
