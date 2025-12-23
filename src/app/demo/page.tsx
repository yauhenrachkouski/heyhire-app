import { redirect } from "next/navigation"

import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { generateId } from "@/lib/id"
import { ensureDemoOrganization, hashShareToken } from "@/lib/demo"

export default async function DemoPage() {
  const demoOrgId = await ensureDemoOrganization()

  // Reuse an existing active demo link if possible.
  const existing = await db.query.organizationShareLink.findFirst({
    where: and(
      eq(schema.organizationShareLink.organizationId, demoOrgId),
      isNull(schema.organizationShareLink.revokedAt),
      isNull(schema.organizationShareLink.expiresAt),
      isNull(schema.organizationShareLink.maxViews)
    ),
    columns: { id: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  const token = existing?.id ?? generateId()

  if (!existing?.id) {
    const tokenHash = hashShareToken(token)

    await db.insert(schema.organizationShareLink).values({
      id: token,
      organizationId: demoOrgId,
      createdByUserId: null,
      tokenHash,
    })
  }

  return redirect(`/p/${token}`)
}


