"use client"

import { useEffect, useRef } from "react"
import posthog from "posthog-js"
import { useActiveOrganization, useSession } from "@/lib/auth-client"

export function PostHogIdentityProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const { data: activeOrg } = useActiveOrganization()

  const userId = session?.user?.id
  const organizationId = activeOrg?.id

  const prevOrganizationIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (userId) {
      posthog.identify(userId)
    }

    const prevOrgId = prevOrganizationIdRef.current

    if (userId && organizationId) {
      posthog.group("organization", organizationId)

      if (prevOrgId && prevOrgId !== organizationId) {
        posthog.capture("organization_switched", {
          from_organization_id: prevOrgId,
          to_organization_id: organizationId,
        })
      }
    }

    prevOrganizationIdRef.current = organizationId
  }, [userId, organizationId])

  return children
}
