"use server"

import "server-only"

import { z } from "zod"
import { and, eq, gt, isNull, or, sql } from "drizzle-orm"
import { headers } from "next/headers"

import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { generateId } from "@/lib/id"
import { auth } from "@/lib/auth"
import { hashShareToken } from "@/lib/demo"
import { ADMIN_ROLES } from "@/lib/roles"

async function requireSignedInUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    throw new Error("Not authenticated")
  }
  return session.user
}

async function requireOrgAdmin(params: { organizationId: string; userId: string }) {
  const member = await db.query.member.findFirst({
    where: and(
      eq(schema.member.organizationId, params.organizationId),
      eq(schema.member.userId, params.userId)
    ),
    columns: { role: true },
  })

  if (!member?.role || !ADMIN_ROLES.has(member.role)) {
    throw new Error("Not authorized")
  }
}

const createShareLinkSchema = z.object({
  organizationId: z.string().min(1),
  expiresAt: z.date().optional(),
  maxViews: z.number().int().positive().optional(),
  preset: z
    .object({
      searchId: z.string().optional(),
    })
    .optional(),
})

export async function createShareLink(input: z.infer<typeof createShareLinkSchema>) {
  const user = await requireSignedInUser()
  const data = createShareLinkSchema.parse(input)

  await requireOrgAdmin({ organizationId: data.organizationId, userId: user.id })

  const id = generateId()
  const token = id
  const tokenHash = hashShareToken(token)

  await db.insert(schema.organizationShareLink).values({
    id,
    organizationId: data.organizationId,
    createdByUserId: user.id,
    tokenHash,
    expiresAt: data.expiresAt,
    maxViews: data.maxViews,
    preset: data.preset ? JSON.stringify(data.preset) : null,
  })

  return { id, token }
}

export async function listShareLinks(organizationId: string) {
  const user = await requireSignedInUser()
  if (!organizationId) throw new Error("Missing organizationId")

  await requireOrgAdmin({ organizationId, userId: user.id })

  const links = await db.query.organizationShareLink.findMany({
    where: eq(schema.organizationShareLink.organizationId, organizationId),
    columns: {
      id: true,
      organizationId: true,
      createdByUserId: true,
      expiresAt: true,
      maxViews: true,
      viewCount: true,
      revokedAt: true,
      preset: true,
      createdAt: true,
      lastViewedAt: true,
    },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  return links.map((l) => ({
    ...l,
    preset: l.preset ? (JSON.parse(l.preset) as unknown) : null,
  }))
}

export async function revokeShareLink(linkId: string) {
  const user = await requireSignedInUser()
  if (!linkId) throw new Error("Missing linkId")

  const link = await db.query.organizationShareLink.findFirst({
    where: eq(schema.organizationShareLink.id, linkId),
    columns: { id: true, organizationId: true },
  })

  if (!link) throw new Error("Share link not found")

  await requireOrgAdmin({ organizationId: link.organizationId, userId: user.id })

  await db
    .update(schema.organizationShareLink)
    .set({ revokedAt: new Date() })
    .where(eq(schema.organizationShareLink.id, linkId))

  return { success: true }
}

export async function validateAndTrackShareToken(token: string) {
  if (!token) throw new Error("Missing token")

  const tokenHash = hashShareToken(token)
  const now = new Date()

  // Atomic increment if still valid.
  const updated = await db
    .update(schema.organizationShareLink)
    .set({
      viewCount: sql`${schema.organizationShareLink.viewCount} + 1`,
      lastViewedAt: now,
    })
    .where(
      and(
        eq(schema.organizationShareLink.tokenHash, tokenHash),
        isNull(schema.organizationShareLink.revokedAt),
        or(
          isNull(schema.organizationShareLink.expiresAt),
          gt(schema.organizationShareLink.expiresAt, now)
        ),
        or(
          isNull(schema.organizationShareLink.maxViews),
          gt(schema.organizationShareLink.maxViews, schema.organizationShareLink.viewCount)
        )
      )
    )
    .returning({
      id: schema.organizationShareLink.id,
      organizationId: schema.organizationShareLink.organizationId,
      preset: schema.organizationShareLink.preset,
      expiresAt: schema.organizationShareLink.expiresAt,
      maxViews: schema.organizationShareLink.maxViews,
      viewCount: schema.organizationShareLink.viewCount,
      revokedAt: schema.organizationShareLink.revokedAt,
    })

  if (updated.length > 0) {
    const row = updated[0]!
    return {
      organizationId: row.organizationId,
      preset: row.preset ? (JSON.parse(row.preset) as unknown) : null,
    }
  }

  // Not updated => invalid or expired/revoked/limit reached. Fetch for better error.
  const existing = await db.query.organizationShareLink.findFirst({
    where: eq(schema.organizationShareLink.tokenHash, tokenHash),
    columns: {
      revokedAt: true,
      expiresAt: true,
      maxViews: true,
      viewCount: true,
    },
  })

  if (!existing) throw new Error("Invalid share link")
  if (existing.revokedAt) throw new Error("Share link revoked")
  if (existing.expiresAt && existing.expiresAt <= now) throw new Error("Share link expired")
  if (
    typeof existing.maxViews === "number" &&
    typeof existing.viewCount === "number" &&
    existing.viewCount >= existing.maxViews
  ) {
    throw new Error("Share link view limit reached")
  }

  throw new Error("Share link invalid")
}

export async function validateShareToken(token: string) {
  if (!token) throw new Error("Missing token")

  const tokenHash = hashShareToken(token)
  const now = new Date()

  const link = await db.query.organizationShareLink.findFirst({
    where: eq(schema.organizationShareLink.tokenHash, tokenHash),
    columns: {
      organizationId: true,
      preset: true,
      revokedAt: true,
      expiresAt: true,
      maxViews: true,
      viewCount: true,
    },
  })

  if (!link) throw new Error("Invalid share link")
  if (link.revokedAt) throw new Error("Share link revoked")
  if (link.expiresAt && link.expiresAt <= now) throw new Error("Share link expired")
  if (
    typeof link.maxViews === "number" &&
    typeof link.viewCount === "number" &&
    link.viewCount >= link.maxViews
  ) {
    throw new Error("Share link view limit reached")
  }

  return {
    organizationId: link.organizationId,
    preset: link.preset ? (JSON.parse(link.preset) as unknown) : null,
  }
}

