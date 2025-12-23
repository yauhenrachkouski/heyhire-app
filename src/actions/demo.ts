"use server"

import "server-only"

import { headers } from "next/headers"
import { eq, and } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { getDemoOrgSlug } from "@/lib/demo"

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


