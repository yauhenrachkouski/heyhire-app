"use client"

import { useEffect, useRef } from "react"
import posthog from "posthog-js"
import { useActiveOrganization, useSession } from "@/lib/auth-client"
import { useQuery } from "@tanstack/react-query"
import { getSubscriptionStatus } from "@/actions/stripe"
import { getOrganizationCredits } from "@/actions/credits"
import { useUserContextStore } from "@/stores/user-context-store"

export function UserContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const { data: activeOrg } = useActiveOrganization()
  const { setUser, setOrganization, setSubscription, clear } = useUserContextStore()

  const userId = session?.user?.id
  const organizationId = activeOrg?.id

  // Track previous org for switch detection
  const prevOrgIdRef = useRef<string | undefined>(undefined)

  // Fetch subscription and credits
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

  // Sync user to Zustand store + PostHog identify
  useEffect(() => {
    if (userId && session?.user?.email && session?.user?.name) {
      // Update Zustand store
      setUser({
        id: userId,
        name: session.user.name,
        email: session.user.email,
      })

      // Identify in PostHog (idempotent - safe to call multiple times)
      posthog.identify(userId, {
        email: session.user.email,
        name: session.user.name,
      })
    } else {
      clear()
      posthog.reset()
    }
  }, [userId, session?.user?.email, session?.user?.name, setUser, clear])

  // Sync organization to Zustand store + PostHog group
  useEffect(() => {
    if (organizationId && activeOrg?.name) {
      // Update Zustand store
      setOrganization({
        id: organizationId,
        name: activeOrg.name,
      })

      // Set PostHog organization group
      posthog.group("organization", organizationId, {
        name: activeOrg.name,
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
    } else {
      setOrganization(null)
    }
  }, [organizationId, activeOrg?.name, setOrganization])

  // Sync subscription to Zustand store + PostHog properties
  useEffect(() => {
    if (subscriptionData) {
      const sub = {
        plan: subscriptionData.plan || "none",
        status: subscriptionData.status || "none",
        isTrialing: subscriptionData.isTrialing || false,
        credits: credits ?? 0,
      }

      // Update Zustand store
      setSubscription(sub)

      // Update PostHog person/group properties
      if (userId && organizationId) {
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
    }
  }, [subscriptionData, credits, userId, organizationId, setSubscription])

  return children
}
