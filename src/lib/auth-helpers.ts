'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

/**
 * Get the current session with active organization context
 * Throws an error if user is not authenticated or has no active organization
 */
export async function getSessionWithOrg() {
  const session = await auth.api.getSession({
    headers: await headers()
  })
  
  if (!session?.user) {
    throw new Error('Not authenticated')
  }
  
  const activeOrgId = session.session.activeOrganizationId
  if (!activeOrgId) {
    throw new Error('No active organization')
  }
  
  return { 
    session, 
    activeOrgId,
    userId: session.user.id 
  }
}

/**
 * Get the current session (without requiring organization context)
 * Useful for pages that don't require organization context
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers()
  })
  
  if (!session?.user) {
    throw new Error('Not authenticated')
  }
  
  return session
}

