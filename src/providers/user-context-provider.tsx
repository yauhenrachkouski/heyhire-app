"use client"

import { useEffect, useRef } from "react"
import posthog from "posthog-js"
import { useActiveOrganization, useSession, authClient } from "@/lib/auth-client"
import { useQuery } from "@tanstack/react-query"
import { getSubscriptionStatus } from "@/actions/stripe"
import { getOrganizationCredits } from "@/actions/credits"
import { useUserContextStore } from "@/stores/user-context-store"

const DEMO_ORG_SLUG = process.env.NEXT_PUBLIC_DEMO_ORG_SLUG || "heyhire-demo"

export function UserContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const { data: activeOrg } = useActiveOrganization()
  const { setUser, setOrganization, setSubscription, setMembership, clear } = useUserContextStore()

  const userId = session?.user?.id
  const organizationId = activeOrg?.id

  // Track previous org for switch detection
  const prevOrgIdRef = useRef<string | undefined>(undefined)

  // Fetch active member role
  const { data: activeMember } = useQuery({
    queryKey: ["active-member", organizationId],
    queryFn: async () => {
      const member = await authClient.organization.getActiveMember()
      return member.data
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  })

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
    if (userId && session?.user?.email) {
      setUser({
        id: userId,
        name: session.user.name ?? "",
        email: session.user.email,
        isAnonymous: session.user.isAnonymous ?? false,
      })

      posthog.identify(userId, {
        email: session.user.email,
        name: session.user.name,
        is_anonymous: session.user.isAnonymous ?? false,
      })
    } else {
      clear()
      posthog.reset()
    }
  }, [userId, session?.user?.email, session?.user?.name, session?.user?.isAnonymous, setUser, clear])

  // Sync organization to Zustand store + PostHog group
  useEffect(() => {
    if (organizationId && activeOrg?.name) {
      setOrganization({
        id: organizationId,
        name: activeOrg.name,
        slug: activeOrg.slug,
      })

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
    } else {
      setOrganization(null)
    }
  }, [organizationId, activeOrg?.name, activeOrg?.slug, setOrganization])

  // Sync membership (role) to Zustand store
  useEffect(() => {
    if (activeMember?.role && activeOrg?.slug) {
      const isDemoMode = activeOrg.slug === DEMO_ORG_SLUG
      setMembership({
        role: activeMember.role,
        isDemoMode,
      })
    } else {
      setMembership(null)
    }
  }, [activeMember?.role, activeOrg?.slug, setMembership])

  // Sync subscription to Zustand store + PostHog properties
  useEffect(() => {
    if (subscriptionData) {
      const sub = {
        plan: subscriptionData.plan || "none",
        status: subscriptionData.status || "none",
        isTrialing: subscriptionData.isTrialing || false,
        credits: credits ?? 0,
      }

      setSubscription(sub)

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
