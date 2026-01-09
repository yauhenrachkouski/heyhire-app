'use server'

import { log } from "@/lib/axiom/server";
import { getSessionWithOrg } from "@/lib/auth-helpers";
import { requirePermission } from "@/lib/request-access";

const source = "actions/account";

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/db/drizzle'
import { account, user, organization as orgTable, member } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { Resend } from 'resend'
import { AccountDeletedEmail } from '@/emails'
import { generateId } from '@/lib/id'
import { getPostHogServer } from '@/lib/posthog/posthog-server'
import sharp from 'sharp'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function updateUserProfile(data: {
  name: string
  image?: string
}) {
  const { userId: sessionUserId, activeOrgId } = await getSessionWithOrg();
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
    log.error("update_profile.error", { source, userId: sessionUserId, organizationId: activeOrgId, error: err instanceof Error ? err.message : String(err) })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update profile'
    }
  }
}

export async function uploadAvatar(formData: FormData) {
  const { userId: sessionUserId, activeOrgId } = await getSessionWithOrg();
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

    // Resize to 128x128 max and convert to webp
    const bytes = await file.arrayBuffer()
    const processed = await sharp(Buffer.from(bytes))
      .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()

    const base64 = processed.toString('base64')
    const imageUrl = `data:image/webp;base64,${base64}`

    // Update user image in database
    await db.update(user)
      .set({ image: imageUrl })
      .where(eq(user.id, session.user.id))

    // Revalidate layout to update sidebar avatar
    if (session.session.activeOrganizationId) {
      revalidatePath(`/${session.session.activeOrganizationId}`, 'layout')
    }

    return { success: true, imageUrl }
  } catch (err) {
    log.error("upload_avatar.error", { source, userId: sessionUserId, organizationId: activeOrgId, error: err instanceof Error ? err.message : String(err) })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload avatar'
    }
  }
}

export async function removeAvatar() {
  const { userId: sessionUserId, activeOrgId } = await getSessionWithOrg();
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

    // Revalidate layout to update sidebar avatar
    if (session.session.activeOrganizationId) {
      revalidatePath(`/${session.session.activeOrganizationId}`, 'layout')
    }

    return { success: true }
  } catch (err) {
    log.error("remove_avatar.error", { source, userId: sessionUserId, organizationId: activeOrgId, error: err instanceof Error ? err.message : String(err) })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove avatar'
    }
  }
}

export async function getOrganizationMembership(organizationId: string) {
  const { userId: sessionUserId, activeOrgId } = await getSessionWithOrg();
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
    log.error("get_membership.error", { source, userId: sessionUserId, organizationId: activeOrgId, error: err instanceof Error ? err.message : String(err) })
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
  const { userId: sessionUserId, activeOrgId } = await getSessionWithOrg();
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Only admins and owners can update organization settings
    await requirePermission(data.organizationId, "org_settings");

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
    const newSlug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    await db.update(orgTable)
      .set({
        name: data.name,
        slug: newSlug,
        metadata: JSON.stringify(metadata)
      })
      .where(eq(orgTable.id, data.organizationId))

    // Update organization group in PostHog
    const posthog = getPostHogServer()
    posthog.groupIdentify({
      groupType: 'organization',
      groupKey: data.organizationId,
      properties: {
        name: data.name,
        slug: newSlug,
        ...(data.size && { size: data.size }),
      },
    })

    // Revalidate org layout to ensure server components get fresh data
    revalidatePath(`/${data.organizationId}`, 'layout')

    return { success: true }
  } catch (err) {
    log.error("update_org.error", { source, userId: sessionUserId, organizationId: activeOrgId, error: err instanceof Error ? err.message : String(err) })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update organization'
    }
  }
}

export async function getUserAccounts() {
  const { userId: sessionUserId, activeOrgId } = await getSessionWithOrg();
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
    log.error("get_accounts.error", { source, userId: sessionUserId, organizationId: activeOrgId, error: err instanceof Error ? err.message : String(err) })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to get accounts',
      data: []
    }
  }
}

export async function unlinkAccount(accountId: string) {
  const { userId: sessionUserId, activeOrgId } = await getSessionWithOrg();
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
    log.error("unlink.error", { source, userId: sessionUserId, organizationId: activeOrgId, accountId, error: err instanceof Error ? err.message : String(err) })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to unlink account'
    }
  }
}

export async function softDeleteAccount() {
  const { userId: sessionUserId, activeOrgId } = await getSessionWithOrg();
  let userId: string | undefined;
  let organizationId: string | null | undefined;
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return { success: false, error: 'Not authenticated' }
    }

    userId = session.user.id;
    organizationId = session.session.activeOrganizationId;

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
      log.warn("deleted_email.failed", { source, userId, organizationId, error: e instanceof Error ? e.message : String(e) })
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
    log.error("delete.error", { source, userId: sessionUserId, organizationId: activeOrgId, error: err instanceof Error ? err.message : String(err) })
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
  let userId: string | undefined;
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      log.error("create_org.no_auth", { source })
      return { success: false, error: 'Not authenticated' }
    }

    userId = session.user.id;
    const activeOrgId = session.session.activeOrganizationId;

    log.info("create_org.started", {
      source,
      userId,
      organizationId: activeOrgId,
      name: data.name,
      size: data.size,
    })

    // Check if user already has an organization
    const existingMembership = await db.query.member.findFirst({
      where: eq(member.userId, session.user.id)
    })

    if (existingMembership) {
      log.info("create_org.existing_found", {
        source,
        userId,
        organizationId: existingMembership.organizationId,
      })
      // User already has an organization, just set it as active and return
      await auth.api.setActiveOrganization({
        headers: await headers(),
        body: { organizationId: existingMembership.organizationId }
      })

      revalidatePath(`/${existingMembership.organizationId}`, 'layout')
      revalidatePath('/paywall')

      return { success: true, organizationId: existingMembership.organizationId }
    }

    const organizationName = data.name.trim() || 'Default Workspace'
    const slug = `${organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${generateId().slice(0, 8)}`

    log.debug("create_org.slug_generated", { source, userId, organizationId: activeOrgId, slug })

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
      log.error("create_org.failed", { source, userId, organizationId: activeOrgId, reason: "no_result" })
      throw new Error('Failed to create organization')
    }

    log.info("create_org.created", {
      source,
      userId,
      organizationId: createResult.id,
    })

    // Set the newly created organization as active
    await auth.api.setActiveOrganization({
      headers: await headers(),
      body: { organizationId: createResult.id }
    })

    revalidatePath(`/${createResult.id}`, 'layout')
    revalidatePath('/paywall')

    log.info("create_org.completed", { source, userId, organizationId: createResult.id })

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
    log.error("create_org.error", { source, userId, error: err instanceof Error ? err.message : String(err) })
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create organization'
    }
  }
}

