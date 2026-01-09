"use server"

import "server-only"

import { headers } from "next/headers"
import { eq, and } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { ensureDemoOrganization } from "@/lib/demo"
import { generateId } from "@/lib/id"
import { ROLES } from "@/lib/roles"

/**
 * Add current user to demo organization with demo_viewer role.
 * Used for anonymous demo access flow.
 */
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

  if (existingMember?.id) {
    return { success: true, organizationId: demoOrgId }
  }

  await db.insert(schema.member).values({
    id: generateId(),
    organizationId: demoOrgId,
    userId: session.user.id,
    role: ROLES.demo_viewer,
  })

  return { success: true, organizationId: demoOrgId }
}

