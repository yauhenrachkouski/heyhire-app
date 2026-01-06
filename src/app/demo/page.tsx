import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { eq, and } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { ensureDemoOrganization, getDemoOrgSlug } from "@/lib/demo"
import { DemoAutoAuth } from "@/components/demo/demo-auto-auth"

export default async function DemoPage() {
  const headersList = await headers()
  const session = await auth.api.getSession({ headers: headersList })

  // Ensure demo org exists
  const demoOrgId = await ensureDemoOrganization()

  // If user is already authenticated
  if (session?.user) {
    // Check if user is already a member of demo org
    const existingMember = await db.query.member.findFirst({
      where: and(
        eq(schema.member.organizationId, demoOrgId),
        eq(schema.member.userId, session.user.id)
      ),
      columns: { id: true },
    })

    if (existingMember) {
      // User is already in demo org, set it as active and redirect
      await auth.api.setActiveOrganization({
        headers: headersList,
        body: { organizationId: demoOrgId },
      })
      return redirect(`/${demoOrgId}`)
    }
  }

  // Not authenticated or not in demo org - show auto-auth component
  return <DemoAutoAuth redirectTo={`/${demoOrgId}`} />
}
