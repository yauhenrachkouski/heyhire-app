import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { SettingsPageHeader } from '@/components/account/settings-page-header'
import { UsageHistoryCard } from '@/components/account/usage-history-card'
import { redirect } from 'next/navigation'

export default async function UsagePage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user) {
    redirect('/auth/signin')
  }

  return (
    <>
      <SettingsPageHeader
        title="Usage History"
        description="View your credit consumption history"
      />

      <UsageHistoryCard />
    </>
  )
}
