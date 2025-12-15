import { SettingsPageHeader } from "@/components/account/settings-page-header"

export const dynamic = "force-dynamic"

export default function AccountHeader() {
  return (
    <SettingsPageHeader
      title="Account"
      description="Manage your personal account settings"
    />
  )
}
