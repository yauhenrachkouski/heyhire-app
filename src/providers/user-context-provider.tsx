"use client"

import { useEffect, useRef } from "react"
import posthog from "posthog-js"
import { useActiveOrganization, useSession, authClient } from "@/lib/auth-client"
import { useQuery } from "@tanstack/react-query"
import { getSubscriptionStatus } from "@/actions/stripe"
import { getOrganizationCredits } from "@/actions/credits"
import { setLoggingContext, clearLoggingContext } from "@/lib/logging-context"

export function UserContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const { data: activeOrg } = useActiveOrganization()

  const userId = session?.user?.id
  const organizationId = activeOrg?.id

  // Track previous org for switch detection
  const prevOrgIdRef = useRef<string | undefined>(undefined)

  // Fetch subscription and credits for PostHog properties
  const { data: subscriptionData } = useQuery({
    queryKey: ["subscription-status", organizationId],
    queryFn: () => getSubscriptionStatus(),
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: credits } = useQuery({
    queryKey: ["credits", organizationId],
    queryFn: () => organizationId ? getOrganizationCredits(organizationId) : Promise.resolve(0),
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  })

  // Sync to logging context + PostHog identify
  useEffect(() => {
    if (userId && session?.user?.email) {
      setLoggingContext({ userId, organizationId })

      posthog.identify(userId, {
        email: session.user.email,
        name: session.user.name,
        is_anonymous: session.user.isAnonymous ?? false,
      })
    } else {
      clearLoggingContext()
      posthog.reset()
    }
  }, [userId, organizationId, session?.user?.email, session?.user?.name, session?.user?.isAnonymous])

  // PostHog group + org switch tracking
  useEffect(() => {
    if (organizationId && activeOrg?.name) {
      posthog.group("organization", organizationId, {
        name: activeOrg.name,
        slug: activeOrg.slug,
      })

      // Track org switch event
      const prevOrgId = prevOrgIdRef.current
      if (prevOrgId && prevOrgId !== organizationId) {
        posthog.capture("organization_switched", {
          from_organization_id: prevOrgId,
          to_organization_id: organizationId,
        })
      }
      prevOrgIdRef.current = organizationId
    }
  }, [organizationId, activeOrg?.name, activeOrg?.slug])

  // Sync subscription to PostHog properties
  useEffect(() => {
    if (subscriptionData && userId && organizationId) {
      const sub = {
        plan: subscriptionData.plan || "none",
        status: subscriptionData.status || "none",
        isTrialing: subscriptionData.isTrialing || false,
        credits: credits ?? 0,
      }

      posthog.setPersonProperties({
        current_plan: sub.plan,
        subscription_status: sub.status,
        is_trialing: sub.isTrialing,
        credits_remaining: sub.credits,
      })

      posthog.group("organization", organizationId, {
        plan: sub.plan,
        subscription_status: sub.status,
        is_trialing: sub.isTrialing,
        credits_remaining: sub.credits,
      })
    }
  }, [subscriptionData, credits, userId, organizationId])

  return children
}
