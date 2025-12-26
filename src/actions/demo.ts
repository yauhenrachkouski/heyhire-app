"use server"

import "server-only"

import { headers } from "next/headers"
import { eq, and } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { getDemoOrgSlug, ensureDemoOrganization } from "@/lib/demo"
import { generateId } from "@/lib/id"

export async function addDemoWorkspaceForCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Not authenticated")

  const demoOrgId = await ensureDemoOrganization()

  const existingMember = await db.query.member.findFirst({
    where: and(
      eq(schema.member.organizationId, demoOrgId),
      eq(schema.member.userId, session.user.id)
    ),
    columns: { id: true },
  })

  if (existingMember?.id) return { success: true }

  await db.insert(schema.member).values({
    id: generateId(),
    organizationId: demoOrgId,
    userId: session.user.id,
    role: "viewer",
  })

  return { success: true }
}

export async function removeDemoWorkspaceForCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Not authenticated")

  const demoOrg = await db.query.organization.findFirst({
    where: eq(schema.organization.slug, getDemoOrgSlug()),
    columns: { id: true },
  })

  if (!demoOrg?.id) return { success: true }

  await db
    .delete(schema.member)
    .where(
      and(
        eq(schema.member.organizationId, demoOrg.id),
        eq(schema.member.userId, session.user.id)
      )
    )

  return { success: true }
}

