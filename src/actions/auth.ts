'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

export async function createOrganization(data: {
  name?: string
  userName: string
  organizationSize?: string
}) {
  try {
    const orgName = data.name?.trim() || 'Default Workspace'
    const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    
    const metadata = data.organizationSize 
      ? { size: data.organizationSize }
      : undefined

    const result = await auth.api.createOrganization({
      body: {
        name: orgName,
        slug: orgSlug,
        metadata,
      },
      headers: await headers(),
    })

    return { success: true, data: result }
  } catch (err) {
    console.error('Failed to create organization:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to create organization' 
    }
  }
}
