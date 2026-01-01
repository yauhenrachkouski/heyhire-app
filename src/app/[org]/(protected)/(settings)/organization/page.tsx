import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { OrganizationForm } from '@/components/account/organization-form'
import { redirect } from 'next/navigation'
import { SimpleMembersTable } from './simple-members-table'
import { getMembers } from '@/actions/members'
import { listShareLinks } from '@/actions/share-links'

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

  const activeMember = await auth.api.getActiveMember({ headers: await headers() })

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
    limit: 100,
    offset: 0,
  })

  const shareLinks =
    currentOrganization && (activeMember?.role === 'owner' || activeMember?.role === 'admin')
      ? await listShareLinks(currentOrganization.id)
      : []

  return (
    <>
      {/* Organization Name Section */}
      {organizationData && (
        <OrganizationForm organization={organizationData} />
      )}

      {/* Members Section - Simplified */}
      {currentOrganization && (
        <SimpleMembersTable 
          members={membersData.data} 
          organizationId={currentOrganization.id}
          currentUserId={session.user.id}
        />
      )}

      
    </>
  )
}

