import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Icon } from '@/components/ui/icon'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProfileForm } from '@/components/account/profile-form'
import { OrganizationForm } from '@/components/account/organization-form'
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

  // Fetch organizations
  const organizations = await auth.api.listOrganizations({
    headers: await headers()
  })

  // Fetch active organization
  const activeOrganization = await auth.api.getFullOrganization({
    headers: await headers()
  })

  // Use active organization or first organization as fallback
  const currentOrganization = activeOrganization || (organizations && organizations.length > 0 ? organizations[0] : null)

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

  // Prepare organization data for OrganizationForm
  let organizationData = null
  if (currentOrganization) {
    let size = ''
    if (currentOrganization.metadata) {
      try {
        const metadata = typeof currentOrganization.metadata === 'string' 
          ? JSON.parse(currentOrganization.metadata) 
          : currentOrganization.metadata
        size = metadata.size || ''
      } catch (e) {
        console.error('Failed to parse organization metadata:', e)
      }
    }

    organizationData = {
      id: currentOrganization.id,
      name: currentOrganization.name || '',
      size
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <Separator />

      {/* Profile Section */}
      <ProfileForm user={userData} />

      {/* Organization Section */}
      {organizationData && (
        <OrganizationForm organization={organizationData} />
      )}

      {/* Security / OAuth Section */}
      <ConnectedAccountsSection accounts={accounts} />

      {/* Billing & Subscription (Placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle>Billing & Subscription</CardTitle>
          <CardDescription>
            Manage your billing and subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Icon name="sparkles" className="h-4 w-4" />
            <AlertDescription>
              Billing and subscription management coming soon!
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <DeleteAccountDialog userEmail={session.user.email} />
    </div>
  )
}
