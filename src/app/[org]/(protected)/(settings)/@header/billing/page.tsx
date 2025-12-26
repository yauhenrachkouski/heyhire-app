import { SettingsPageHeader } from "@/components/account/settings-page-header"

export const dynamic = "force-dynamic"

export default function BillingHeader() {
  return (
    <SettingsPageHeader
      title="Billing"
      description="Manage your subscription and billing"
    />
  )
}
