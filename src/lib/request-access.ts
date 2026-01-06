import "server-only"

import { headers } from "next/headers"
import { and, eq } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { isReadOnlyRole, hasPermission, type Permission } from "@/lib/roles"

export async function getSignedInUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return session.user
}

export async function requireOrganizationReadAccess(organizationId: string) {
  const user = await getSignedInUser()
  if (!user) throw new Error("Not authenticated")

  const member = await db.query.member.findFirst({
    where: and(
      eq(schema.member.organizationId, organizationId),
      eq(schema.member.userId, user.id)
    ),
    columns: { id: true, role: true },
  })

  if (!member?.id) throw new Error("Not authorized")

  return { mode: "auth" as const, organizationId, userId: user.id, role: member.role }
}

export async function requireSearchReadAccess(searchId: string) {
  const searchRow = await db.query.search.findFirst({
    where: eq(schema.search.id, searchId),
    columns: { id: true, organizationId: true },
  })
  if (!searchRow) throw new Error("Search not found")

  await requireOrganizationReadAccess(searchRow.organizationId)
  return searchRow
}

export async function assertNotReadOnlyForOrganization(organizationId: string) {
  const user = await getSignedInUser()
  // If there is no user session (e.g. background jobs), we don't block here.
  if (!user) return

  const member = await db.query.member.findFirst({
    where: and(
      eq(schema.member.organizationId, organizationId),
      eq(schema.member.userId, user.id)
    ),
    columns: { role: true },
  })

  if (!member?.role) throw new Error("Not authorized")
  if (isReadOnlyRole(member.role)) throw new Error("Read-only")
}

/**
 * Get the current user's role in an organization.
 * Returns null if not authenticated or not a member.
 */
export async function getUserRole(organizationId: string) {
  const user = await getSignedInUser()
  if (!user) return null

  const member = await db.query.member.findFirst({
    where: and(
      eq(schema.member.organizationId, organizationId),
      eq(schema.member.userId, user.id)
    ),
    columns: { role: true },
  })

  return member?.role ?? null
}

/**
 * Require a specific permission to access a resource.
 * Throws an error if the user doesn't have the permission.
 */
export async function requirePermission(organizationId: string, permission: Permission) {
  const user = await getSignedInUser()
  if (!user) throw new Error("Not authenticated")

  const member = await db.query.member.findFirst({
    where: and(
      eq(schema.member.organizationId, organizationId),
      eq(schema.member.userId, user.id)
    ),
    columns: { role: true },
  })

  if (!member?.role) throw new Error("Not authorized")
  if (!hasPermission(member.role, permission)) {
    throw new Error(`Permission denied: ${permission}`)
  }

  return { userId: user.id, role: member.role }
}
