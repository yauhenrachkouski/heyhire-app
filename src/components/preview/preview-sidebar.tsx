"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"

interface RecentSearch {
  id: string
  name: string
}

interface PreviewSidebarProps extends React.ComponentProps<typeof Sidebar> {
  token: string
  organizationName: string
  recentSearches: RecentSearch[]
}

export function PreviewSidebar({
  token,
  organizationName,
  recentSearches,
  ...props
}: PreviewSidebarProps) {
  const pathname = usePathname()
  const baseUrl = `/p/${token}`

  const isSearchesActive = pathname === baseUrl

  return (
    <TooltipProvider>
      <Sidebar {...props} collapsible="icon">
        <SidebarHeader>
          {/* Organization display (no switcher in preview) */}
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="cursor-default">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <Image
                    src="/favicon.png"
                    alt="Workspace"
                    width={16}
                    height={16}
                    className="invert"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <div className="truncate font-semibold">{organizationName}</div>
                  <span className="mt-0.5 truncate rounded-full text-xs font-medium text-muted-foreground">
                    Preview Mode
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {/* Main navigation - preview safe only */}
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isSearchesActive}
                    tooltip="Searches"
                  >
                    <Link href={baseUrl}>
                      <Icon name="search" />
                      <span>Searches</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Recent Searches Section */}
          {recentSearches.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Recent</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {recentSearches.map((search) => {
                    const searchUrl = `${baseUrl}/search/${search.id}`
                    const isActive = pathname === searchUrl
                    return (
                      <SidebarMenuItem key={search.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={search.name}
                        >
                          <Link href={searchUrl}>
                            <Icon name="file-text" />
                            <span className="truncate">{search.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Home page">
                <a
                  href="https://heyhire.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="home" />
                  <span>Home page</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* Sign up CTA */}
          <div className="p-2">
            <Button asChild className="w-full">
              <Link href="/auth/signin">Sign up to interact</Link>
            </Button>
          </div>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </TooltipProvider>
  )
}



