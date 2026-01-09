import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { eq, and } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { ensureDemoOrganization } from "@/lib/demo"
import { DemoAutoAuth } from "@/components/demo/demo-auto-auth"
import { DemoIframeGuard } from "@/components/demo/demo-iframe-guard"

// Allowed domains that can embed the demo iframe
const ALLOWED_EMBED_ORIGINS = [
  "https://lp.heyhire.ai",
  "https://heyhire.ai",
  "https://www.heyhire.ai",
  // Development
  "http://localhost:4321",
  "http://localhost:3000",
]

export default async function DemoPage() {
  const headersList = await headers()
  const session = await auth.api.getSession({ headers: headersList })

  // Check if request is coming from an allowed embed origin
  const referer = headersList.get("referer")
  const secFetchDest = headersList.get("sec-fetch-dest")

  // sec-fetch-dest: "iframe" indicates the request is for an iframe
  // Also check referer as fallback
  const isIframeRequest = secFetchDest === "iframe"
  const isFromAllowedOrigin = referer && ALLOWED_EMBED_ORIGINS.some(origin => referer.startsWith(origin))

  // In production, require either iframe header or allowed referer
  // This prevents direct access to /demo outside of the landing page iframe
  const isDev = process.env.NODE_ENV === "development"
  const isAllowedAccess = isDev || isIframeRequest || isFromAllowedOrigin

  // Block access if not from allowed context (iframe or allowed origin)
  if (!isAllowedAccess) {
    return (
      <DemoIframeGuard serverValidated={false}>
        {/* This won't render - DemoIframeGuard will show blocked message */}
        <div />
      </DemoIframeGuard>
    )
  }

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
  // Wrap with DemoIframeGuard for client-side backup protection
  return (
    <DemoIframeGuard serverValidated={true}>
      <DemoAutoAuth redirectTo={`/${demoOrgId}`} />
    </DemoIframeGuard>
  )
}
