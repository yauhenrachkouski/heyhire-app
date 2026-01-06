"use client"

import { useQuery } from "@tanstack/react-query"
import { authClient, useActiveOrganization } from "@/lib/auth-client"
import { hasPermission, isReadOnlyRole, type Permission } from "@/lib/roles"

const DEMO_ORG_SLUG = process.env.NEXT_PUBLIC_DEMO_ORG_SLUG || "heyhire-demo"

export function useUserRole() {
  const { data: activeOrg } = useActiveOrganization()

  const { data: activeMember } = useQuery({
    queryKey: ["active-member", activeOrg?.id],
    queryFn: async () => {
      const result = await authClient.organization.getActiveMember()
      return result.data
    },
    enabled: !!activeOrg?.id,
    staleTime: 5 * 60 * 1000,
  })

  const role = activeMember?.role ?? null
  const isDemoMode = activeOrg?.slug === DEMO_ORG_SLUG
  const isReadOnly = isDemoMode || isReadOnlyRole(role)

  return {
    role,
    isDemoMode,
    isReadOnly,
    can: (permission: Permission) => hasPermission(role, permission),
  }
}
