"use client"

import * as React from "react"
import { organization } from "@/lib/auth-client"
import { Icon } from "@/components/ui/icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import type { subscription } from "@/db/schema"

type SubscriptionType = typeof subscription.$inferSelect

// Define organization type based on better-auth API response
interface Organization {
  id: string
  name: string
  slug: string
  logo?: string | null
  metadata?: Record<string, any> | null
  createdAt: Date
}

interface OrganizationSwitcherProps {
  subscription: SubscriptionType | null
  organizations?: Organization[] | null
  activeOrganization?: Organization | null
}

export function OrganizationSwitcher({ 
  subscription, 
  organizations: serverOrganizations,
  activeOrganization: serverActiveOrganization 
}: OrganizationSwitcherProps) {
  const router = useRouter()
  const { isMobile } = useSidebar()

  // Debug: Log what props we received
  console.log('[OrgSwitcher] Received props:', {
    hasSubscription: !!subscription,
    organizationsCount: serverOrganizations?.length ?? 0,
    organizationsList: serverOrganizations?.map(o => ({ id: o.id, name: o.name })) ?? [],
    hasActiveOrg: !!serverActiveOrganization,
    activeOrgId: serverActiveOrganization?.id,
    activeOrgName: serverActiveOrganization?.name
  })

  // Use server-provided data directly (no loading state needed)
  // If organizations list is empty but we have an activeOrganization, use it as fallback
  const organizations = (serverOrganizations && serverOrganizations.length > 0) 
    ? serverOrganizations 
    : serverActiveOrganization 
      ? [serverActiveOrganization]
      : []
  
  const activeOrganization = serverActiveOrganization

  const getPlanDisplay = () => {
    if (!subscription) return "No active plan"
    
    if (subscription.status === "trialing") {
      return "Free Trial"
    }
    
    if (subscription.status === "active") {
      const planName = subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
      return `${planName} Plan`
    }
    
    return "Inactive"
  }

  const getPlanBadgeVariant = () => {
    if (!subscription) return "secondary"
    if (subscription.status === "trialing") return "default"
    if (subscription.status === "active") return "default"
    return "secondary"
  }

  // Handle no organizations case - ONLY show if BOTH organizations and activeOrganization are missing
  if ((!organizations || organizations.length === 0) && !activeOrganization) {
    console.log('[OrgSwitcher] No organizations available - showing error state')
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-orange-500 text-white">
              <Icon name="alert-circle" className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold text-orange-600">No Organization</span>
              <span className="truncate text-xs text-orange-500">Contact admin</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Use active organization or first organization as fallback
  const displayOrg = activeOrganization || organizations[0]
  
  const handleOrganizationSwitch = async (orgId: string) => {
    await organization.setActive({ organizationId: orgId })
    router.push("/")
  }
  
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Icon name="building" className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{displayOrg.name}</span>
                <span className="truncate text-xs text-muted-foreground">{getPlanDisplay()}</span>
              </div>
              <Icon name="selector" className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Organizations
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => handleOrganizationSwitch(org.id)}
                  disabled={org.id === displayOrg.id}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <Icon name="building" className="size-4 shrink-0" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="truncate font-medium">{org.name}</div>
                  </div>
                  {org.id === displayOrg.id && (
                    <Icon name="check" className="size-4 text-green-600" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
} 