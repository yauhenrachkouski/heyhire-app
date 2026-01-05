"use client"

import { useEffect, useRef } from "react"
import posthog from "posthog-js"
import { useActiveOrganization, useSession } from "@/lib/auth-client"
import { useQuery } from "@tanstack/react-query"
import { getSubscriptionStatus } from "@/actions/stripe"
import { getOrganizationCredits } from "@/actions/credits"

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

  // Fetch subscription and credits for user properties
  const { data: subscriptionData } = useQuery({
    queryKey: ["subscription-status", organizationId],
    queryFn: () => getSubscriptionStatus(),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: credits } = useQuery({
    queryKey: ["credits", organizationId],
    queryFn: () => organizationId ? getOrganizationCredits(organizationId) : Promise.resolve(0),
    enabled: !!organizationId,
    staleTime: 60 * 1000, // 1 minute
  })

  useEffect(() => {
    if (userId) {
      posthog.identify(userId, {
        email: session?.user?.email,
        name: session?.user?.name,
      })
    }

    const prevOrgId = prevOrganizationIdRef.current

    if (userId && organizationId) {
      posthog.group("organization", organizationId, {
        name: activeOrg?.name,
      })

      if (prevOrgId && prevOrgId !== organizationId) {
        posthog.capture("organization_switched", {
          from_organization_id: prevOrgId,
          to_organization_id: organizationId,
        })
      }
    }

    prevOrganizationIdRef.current = organizationId
  }, [userId, organizationId, session?.user?.email, session?.user?.name, activeOrg?.name])

  // Update person properties when subscription/credits change
  useEffect(() => {
    if (userId && organizationId && subscriptionData) {
      posthog.setPersonProperties({
        current_plan: subscriptionData.plan || "none",
        subscription_status: subscriptionData.status || "none",
        is_trialing: subscriptionData.isTrialing || false,
        credits_remaining: credits ?? 0,
      })

      // Also set group properties for organization-level analytics
      posthog.group("organization", organizationId, {
        plan: subscriptionData.plan || "none",
        subscription_status: subscriptionData.status || "none",
        is_trialing: subscriptionData.isTrialing || false,
        credits_remaining: credits ?? 0,
      })
    }
  }, [userId, organizationId, subscriptionData, credits])

  return children
}
