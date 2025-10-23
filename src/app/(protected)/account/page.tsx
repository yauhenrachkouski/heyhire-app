import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { Separator } from '@/components/ui/separator'
import { ProfileForm } from '@/components/account/profile-form'
import { ConnectedAccountsSection } from '@/components/account/connected-accounts-section'
import { DeleteAccountDialog } from '@/components/account/delete-account-dialog'
import { getUserAccounts } from '@/actions/account'
import { redirect } from 'next/navigation'

export default async function AccountPage() {
  // Fetch session data on the server
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Fetch OAuth accounts
  const accountsResult = await getUserAccounts()
  const accounts = accountsResult.success && accountsResult.data ? accountsResult.data : []

  // Calculate user initials
  const userInitials = (session.user.name || '')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  // Prepare user data for ProfileForm
  const userData = {
    name: session.user.name || '',
    email: session.user.email,
    image: session.user.image || null,
    initials: userInitials
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Account</h1>
        <p className="text-muted-foreground mt-1">
          Manage your personal account settings
        </p>
      </div>

      <Separator />

      {/* Profile Section */}
      <ProfileForm user={userData} />

      {/* Security / OAuth Section */}
      <ConnectedAccountsSection accounts={accounts} />

      {/* Danger Zone */}
      <DeleteAccountDialog userEmail={session.user.email} />
    </div>
  )
}

