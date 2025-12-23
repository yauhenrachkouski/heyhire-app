import "server-only"

import { cookies, headers } from "next/headers"
import { and, eq } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { hashShareToken } from "@/lib/demo"

/**
 * Get preview access from cookie. This does a lightweight lookup that
 * trusts the layout already validated the token fully.
 * Only use this in pages under /p/[token]/ where layout runs first.
 */
export async function getPreviewAccess() {
  const token = (await cookies()).get("hh_preview_token")?.value
  if (!token) return null

  // Lightweight lookup - layout already validated expiry/revoke/limits
  const tokenHash = hashShareToken(token)
  const link = await db.query.organizationShareLink.findFirst({
    where: eq(schema.organizationShareLink.tokenHash, tokenHash),
    columns: { organizationId: true },
  })

  if (!link) return null
  return { token, organizationId: link.organizationId }
}

export async function getSignedInUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return session.user
}

export async function requireOrganizationReadAccess(organizationId: string) {
  const preview = await getPreviewAccess()
  if (preview) {
    if (preview.organizationId !== organizationId) {
      throw new Error("Not authorized")
    }
    return { mode: "preview" as const, organizationId }
  }

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
  const preview = await getPreviewAccess()
  if (preview) {
    // Any preview access is read-only by definition.
    throw new Error("Read-only preview")
  }

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
  if (member.role === "viewer") throw new Error("Read-only")
}


