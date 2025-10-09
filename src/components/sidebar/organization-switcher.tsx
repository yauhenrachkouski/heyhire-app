"use client"

import * as React from "react"
import { useListOrganizations, useActiveOrganization, organization } from "@/lib/auth-client"
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

export function OrganizationSwitcher() {
  const { data: organizations, isPending: isLoadingOrgs } = useListOrganizations()
  const { data: activeOrganization } = useActiveOrganization()
  const router = useRouter()
  const { isMobile } = useSidebar()

  // Show loading state while fetching organizations
  if (isLoadingOrgs) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <Skeleton className="flex aspect-square size-8 rounded-lg !bg-muted-foreground/20" />
            <div className="grid flex-1 gap-1.5 text-left text-sm leading-tight">
              <Skeleton className="h-4 w-28 !bg-muted-foreground/20" />
              <Skeleton className="h-3 w-20 !bg-muted-foreground/20" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Handle no organizations case
  if (!organizations || organizations.length === 0) {
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
                <span className="truncate text-xs">{organizations.length} organization{organizations.length !== 1 ? 's' : ''}</span>
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
                    <div className="truncate text-xs text-muted-foreground">{org.slug}</div>
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