"use client"

import * as React from "react"
import { organization, useActiveOrganization, useListOrganizations } from "@/lib/auth-client"
import { Icon } from "@/components/icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { usePathname, useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import type { subscription } from "@/db/schema"
import Image from "next/image"
import { removeDemoWorkspaceForCurrentUser } from "@/actions/demo"
import { useQueryClient } from "@tanstack/react-query"

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

const DEMO_ORG_SLUG = "heyhire-demo"

// Helper function to get logo URL with fallback
const getLogoUrl = (logo: string | null | undefined): string => {
  return logo || "/favicon.png"
}

export function OrganizationSwitcher({ 
  subscription, 
  organizations: serverOrganizations,
  activeOrganization: serverActiveOrganization 
}: OrganizationSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { isMobile, state } = useSidebar()
  const queryClient = useQueryClient()
  const { data: clientActiveOrganization, refetch: refetchActiveOrganization } = useActiveOrganization()
  const { refetch: refetchOrganizations } = useListOrganizations()

  // Use server-provided data directly (no loading state needed)
  // If organizations list is empty but we have an activeOrganization, use it as fallback
  const organizations = (serverOrganizations && serverOrganizations.length > 0) 
    ? serverOrganizations 
    : serverActiveOrganization 
      ? [serverActiveOrganization]
      : []
  
  const activeOrganization = clientActiveOrganization ?? serverActiveOrganization

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
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg border overflow-hidden shrink-0">
              <Image 
                src="/favicon.png" 
                alt="No Organization" 
                width={16} 
                height={16} 
              />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
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
    await Promise.all([
      refetchActiveOrganization(),
      refetchOrganizations(),
      queryClient.invalidateQueries(),
    ])

    const pathSegments = pathname?.split("/") ?? []
    const restPath = pathSegments.length > 2 ? `/${pathSegments.slice(2).join("/")}` : ""
    const shouldRedirectToSearchHome = restPath.startsWith("/search/") && restPath.split("/").length > 2
    const nextPath = shouldRedirectToSearchHome
      ? `/${orgId}/search`
      : `/${orgId}${restPath}`

    router.push(nextPath || `/${orgId}`)
  }

  const handleRemoveDemo = async () => {
    try {
      await removeDemoWorkspaceForCurrentUser()
      router.refresh()
    } catch (e) {
      console.error("[OrgSwitcher] Failed to remove demo organization", e)
    }
  }
  
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={state === "collapsed" ? displayOrg.name : undefined}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg border overflow-hidden shrink-0">
                <Image 
                  src={getLogoUrl(displayOrg.logo)} 
                  alt="Workspace" 
                  width={16} 
                  height={16} 
                  className={displayOrg.logo ? "object-cover" : ""}
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <div className="truncate font-semibold">{displayOrg.name}</div>
                <span className="mt-0.5 truncate rounded-full text-xs font-medium text-muted-foreground">
                  {getPlanDisplay()}
                </span>
              </div>
              <Icon name="selector" className="ml-auto group-data-[collapsible=icon]:hidden" />
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
                  className="gap-2 p-2 cursor-pointer"
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border overflow-hidden">
                    <Image 
                      src={getLogoUrl(org.logo)} 
                      alt="Organization" 
                      width={16} 
                      height={16} 
                      className={org.logo ? "object-cover shrink-0" : "shrink-0"}
                    />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="truncate font-medium">{org.name}</div>
                  </div>
                  {org.id === displayOrg.id && (
                    <Icon name="check" className="size-4 text-green-600" />
                  )}
                  {org.slug === DEMO_ORG_SLUG && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleRemoveDemo()
                      }}
                      className="ml-auto inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label="Leave demo workspace"
                    >
                      <Icon name="trash" className="size-4" />
                    </button>
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
