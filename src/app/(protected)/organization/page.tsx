import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { Separator } from '@/components/ui/separator'
import { OrganizationForm } from '@/components/account/organization-form'
import { redirect } from 'next/navigation'
import { SimpleMembersTable } from './simple-members-table'
import { getMembers } from '@/actions/members'

export default async function OrganizationSettingsPage() {
  // Fetch session data on the server
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Fetch active organization
  const activeOrganization = await auth.api.getFullOrganization({
    headers: await headers()
  })

  // Fetch organizations
  const organizations = await auth.api.listOrganizations({
    headers: await headers()
  })

  // Use active organization or first organization as fallback
  const currentOrganization = activeOrganization || (organizations && organizations.length > 0 ? organizations[0] : null)

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

  // Fetch members for the simplified table (no filters, just basic data)
  const membersData = await getMembers({
    page: "1",
    perPage: "100", // Show more members without pagination
    sort: "",
    filters: "",
    joinOperator: "and"
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Organization Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your organization settings and members
        </p>
      </div>

      <Separator />

      {/* Organization Name Section */}
      {organizationData && (
        <OrganizationForm organization={organizationData} />
      )}

      {/* Members Section - Simplified */}
      {currentOrganization && (
        <SimpleMembersTable 
          members={membersData.data} 
          organizationId={currentOrganization.id}
        />
      )}
    </div>
  )
}

