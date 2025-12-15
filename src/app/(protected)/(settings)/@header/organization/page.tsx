import { SettingsPageHeader } from "@/components/account/settings-page-header"

export const dynamic = "force-dynamic"

export default function OrganizationHeader() {
  return (
    <SettingsPageHeader
      title="Organization Settings"
      description="Manage your organization settings and members"
    />
  )
}
