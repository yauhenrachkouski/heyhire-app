'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/db/drizzle'
import { account, user, organization as orgTable, member } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { Resend } from 'resend'
import { AccountDeletedEmail } from '@/emails'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function updateUserProfile(data: {
  name: string
  image?: string
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Update user in database
    await db.update(user)
      .set({
        name: data.name,
        ...(data.image && { image: data.image })
      })
      .where(eq(user.id, session.user.id))

    return { success: true }
  } catch (err) {
    console.error('Failed to update user profile:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to update profile' 
    }
  }
}

export async function uploadAvatar(formData: FormData) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return { success: false, error: 'Not authenticated' }
    }

    const file = formData.get('file') as File
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'File must be an image' }
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'File size must be less than 5MB' }
    }

    // Convert file to base64 data URL for storage
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const imageUrl = `data:${file.type};base64,${base64}`

    // Update user image in database
    await db.update(user)
      .set({ image: imageUrl })
      .where(eq(user.id, session.user.id))

    return { success: true, imageUrl }
  } catch (err) {
    console.error('Failed to upload avatar:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to upload avatar' 
    }
  }
}

export async function removeAvatar() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Remove user image from database
    await db.update(user)
      .set({ image: null })
      .where(eq(user.id, session.user.id))

    return { success: true }
  } catch (err) {
    console.error('Failed to remove avatar:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to remove avatar' 
    }
  }
}

export async function getOrganizationMembership(organizationId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get user's membership in the organization
    const membership = await db.query.member.findFirst({
      where: and(
        eq(member.organizationId, organizationId),
        eq(member.userId, session.user.id)
      )
    })

    if (!membership) {
      return { success: false, error: 'Membership not found' }
    }

    return { 
      success: true, 
      data: {
        role: membership.role,
        createdAt: membership.createdAt
      }
    }
  } catch (err) {
    console.error('Failed to get organization membership:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get membership' 
    }
  }
}

export async function updateOrganization(data: {
  organizationId: string
  name: string
  size?: string
}) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Parse existing metadata
    const org = await db.query.organization.findFirst({
      where: eq(orgTable.id, data.organizationId)
    })

    if (!org) {
      return { success: false, error: 'Organization not found' }
    }

    const metadata = org.metadata ? JSON.parse(org.metadata) : {}
    if (data.size) {
      metadata.size = data.size
    }

    // Update organization
    await db.update(orgTable)
      .set({
        name: data.name,
        slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        metadata: JSON.stringify(metadata)
      })
      .where(eq(orgTable.id, data.organizationId))

    // Revalidate all protected routes to ensure server components get fresh data
    revalidatePath('/(protected)', 'layout')

    return { success: true }
  } catch (err) {
    console.error('Failed to update organization:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to update organization' 
    }
  }
}

export async function getUserAccounts() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return { success: false, error: 'Not authenticated', data: [] }
    }

    const accounts = await db.query.account.findMany({
      where: eq(account.userId, session.user.id)
    })

    return { 
      success: true, 
      data: accounts.map((acc: { id: string; providerId: string; createdAt: Date }) => ({
        id: acc.id,
        providerId: acc.providerId,
        createdAt: acc.createdAt
      }))
    }
  } catch (err) {
    console.error('Failed to get user accounts:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to get accounts',
      data: []
    }
  }
}

export async function unlinkAccount(accountId: string) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Delete the account (magic link is always available as fallback authentication)
    await db.delete(account)
      .where(and(
        eq(account.id, accountId),
        eq(account.userId, session.user.id)
      ))

    return { success: true }
  } catch (err) {
    console.error('Failed to unlink account:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to unlink account' 
    }
  }
}

export async function softDeleteAccount() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return { success: false, error: 'Not authenticated' }
    }

    try {
      const emailContent = AccountDeletedEmail({
        userNameOrEmail: session.user.name || session.user.email,
      })
      await resend.emails.send({
        from: process.env.EMAIL_FROM as string,
        to: session.user.email,
        subject: 'Your Heyhire account was deleted',
        react: emailContent,
      })
    } catch (e) {
      console.warn('Failed to send account deleted email', e)
    }

    // Soft delete by setting a deletedAt timestamp
    // For now, we'll use the updatedAt field and add a special marker in the name
    // In production, you'd add a deletedAt field to the schema
    await db.update(user)
      .set({
        name: `[DELETED] ${session.user.name}`,
        email: `deleted_${session.user.id}@deleted.com`,
      })
      .where(eq(user.id, session.user.id))

    // Sign out the user
    await auth.api.signOut({
      headers: await headers()
    })

    return { success: true }
  } catch (err) {
    console.error('Failed to delete account:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to delete account' 
    }
  }
}

/**
 * Server-side organization creation with full setup
 * Used in onboarding flow for reliable organization + membership + active session setup
 */
export async function createOrganizationWithSetup(data: {
  name: string
  size?: string
  logo?: string
  googleLink?: string
}) {
  try {
    console.log('[createOrganizationWithSetup] Starting organization creation:', { name: data.name, size: data.size, logo: data.logo, googleLink: data.googleLink })
    
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      console.error('[createOrganizationWithSetup] No authenticated user')
      return { success: false, error: 'Not authenticated' }
    }

    console.log('[createOrganizationWithSetup] User authenticated:', session.user.id)

    // Check if user already has an organization
    const existingMembership = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id)
    })

    if (existingMembership) {
      console.log('[createOrganizationWithSetup] User already has organization:', existingMembership.organizationId)
      // User already has an organization, just set it as active and return
      await auth.api.setActiveOrganization({
        headers: await headers(),
        body: { organizationId: existingMembership.organizationId }
      })

      revalidatePath('/(protected)', 'layout')
      revalidatePath('/paywall')

      return { success: true, organizationId: existingMembership.organizationId }
    }

    const organizationName = data.name.trim() || 'Default Workspace'
    const slug = `${organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomUUID().slice(0, 8)}`

    console.log('[createOrganizationWithSetup] Creating organization with slug:', slug)

    // Use better-auth's server API to create organization
    const createResult = await auth.api.createOrganization({
      headers: await headers(),
      body: {
        name: organizationName,
        slug: slug,
        logo: data.logo,
        googleLink: data.googleLink,
        metadata: data.size ? { size: data.size } : undefined
      }
    })

    if (!createResult) {
      console.error('[createOrganizationWithSetup] Failed to create organization - no result')
      throw new Error('Failed to create organization')
    }

    console.log('[createOrganizationWithSetup] Organization created successfully:', createResult.id)

    // Set the newly created organization as active
    const setActiveResult = await auth.api.setActiveOrganization({
      headers: await headers(),
      body: { organizationId: createResult.id }
    })

    revalidatePath('/(protected)', 'layout')
    revalidatePath('/paywall')

    console.log('[createOrganizationWithSetup] Organization set as active:', setActiveResult)

    // Verify the organization was created by querying it back
    const verifyOrg = await db.query.organization.findFirst({
      where: eq(orgTable.id, createResult.id)
    })

    const verifyMember = await db.query.member.findFirst({
      where: and(
        eq(member.organizationId, createResult.id),
        eq(member.userId, session.user.id)
      )
    })

    console.log('[createOrganizationWithSetup] Verification:', {
      orgExists: !!verifyOrg,
      memberExists: !!verifyMember,
      memberRole: verifyMember?.role
    })

    return { 
      success: true, 
      organizationId: createResult.id,
      organization: {
        id: createResult.id,
        name: createResult.name,
        slug: createResult.slug
      }
    }
  } catch (err) {
    console.error('[createOrganizationWithSetup] Error:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to create organization' 
    }
  }
}

export async function createDefaultOrganization() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if user already has an organization
    const existingMembership = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id)
    })

    if (existingMembership) {
      // User already has an organization; ensure it's set as active in the session
      await auth.api.setActiveOrganization({
        headers: await headers(),
        body: { organizationId: existingMembership.organizationId }
      })

      revalidatePath('/(protected)', 'layout')
      revalidatePath('/paywall')

      return { success: true, organizationId: existingMembership.organizationId }
    }

    // Generate a unique organization ID
    const organizationId = crypto.randomUUID()
    const organizationName = 'Default Workspace'
    const slug = `${organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${organizationId.slice(0, 8)}`

    // Create the organization
    await db.insert(orgTable).values({
      id: organizationId,
      name: organizationName,
      slug: slug,
      metadata: JSON.stringify({ createdBy: 'system', isDefault: true })
    })

    // Create membership with owner role
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: organizationId,
      userId: session.user.id,
      role: 'owner'
    })

    // Set the newly created organization as active
    await auth.api.setActiveOrganization({
      headers: await headers(),
      body: { organizationId }
    })

    revalidatePath('/(protected)', 'layout')
    revalidatePath('/paywall')

    return { success: true, organizationId }
  } catch (err) {
    console.error('Failed to create default organization:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to create default organization' 
    }
  }
}

