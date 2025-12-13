"use client"

import * as React from "react"
import { OrganizationSwitcher } from "@/components/sidebar/organization-switcher"
import { RecentSearches } from "@/components/sidebar/recent-searches"
import { SearchSearches } from "@/components/sidebar/search-searches"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Icon, IconName } from "@/components/ui/icon"
import { NavUser } from "@/components/sidebar/nav-user"
import { SupportModal } from "@/components/sidebar/support-modal"
import { CreditBalance } from "@/components/sidebar/credit-balance"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
  credits?: number
}

// User type based on better-auth session
interface User {
  id: string
  name: string
  email: string
  image?: string | null
  emailVerified?: boolean
  createdAt?: Date
  updatedAt?: Date
}

// Extended interface for menu items with disabled state and sub-items
interface NavItem {
  title: string
  url: string
  icon?: IconName
  isActive?: boolean
  disabled?: boolean
  items?: NavItem[] // Support for sub-items
  fullTitle?: string // Full title for tooltip when title is truncated
}

interface NavGroup {
  title?: string
  url: string
  items: NavItem[]
}

interface RecentSearch {
  id: string
  name: string
  query: string
  createdAt: Date
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  subscription?: SubscriptionType | null
  organizations?: Organization[] | null
  activeOrganization?: Organization | null
  user?: User | null
  recentSearches?: RecentSearch[]
}

// Navigation data for Heyhire recruitment platform
// Disabled items show but are not clickable until implemented
const data: { navMain: NavGroup[] } = {
  navMain: [
    {
      url: "#",
      items: [
        
        {
          title: "New Talent Search",
          url: "/search",
          icon: "search" as IconName,
        },
      ],
    },
    
    {
      title: "Organization",
      url: "#",
      items: [
        {
          title: "Organization",
          url: "/organization",
          icon: "settings" as IconName,
        },
        
        {
          title: "Billing & Plan",
          url: "/billing",
          icon: "credit-card" as IconName,
        },
      ],
    },
    
    
  ],
}

function isPathActive(currentPathname: string, itemUrl: string): boolean {
  if (itemUrl === "/") return currentPathname === "/"
  
  // Special case for /search - only active when exactly on /search, not on individual search pages
  if (itemUrl === "/search") {
    return currentPathname === "/search"
  }
  
  // Special case for /jobs - only active when exactly on /jobs, not on individual job pages
  if (itemUrl === "/jobs") {
    return currentPathname === "/jobs"
  }
  
  return currentPathname === itemUrl || currentPathname.startsWith(`${itemUrl}/`)
}

export function AppSidebar({ subscription, organizations, activeOrganization, user, recentSearches = [], ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const [supportModalOpen, setSupportModalOpen] = React.useState(false)

  // Generate dynamic navigation data with recent job

  return (
    <TooltipProvider>
      <Sidebar {...props} collapsible="icon">
      <SidebarHeader>
        <OrganizationSwitcher 
          subscription={subscription ?? null}
          organizations={organizations}
          activeOrganization={activeOrganization}
        />
        {activeOrganization && (
          <SearchSearches organizationId={activeOrganization.id} />
        )}
      </SidebarHeader>
      <SidebarContent>
        {/* We create a SidebarGroup for each parent. */}
        {/* Render first group (Search People) */}
        {data.navMain[0] && (
          <SidebarGroup key={data.navMain[0].title || 'group-0'}>
            {data.navMain[0].title && <SidebarGroupLabel>{data.navMain[0].title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              {data.navMain[0].items.map((navItem) => {
                const active = !navItem.disabled && isPathActive(pathname, navItem.url)
                
                return (
                  <Button
                    key={navItem.title}
                    asChild
                    variant="default"
                    className="w-full"
                  >
                    <Link href={navItem.url} aria-current={active ? "page" : undefined} prefetch>
                      {navItem.icon && <Icon name={navItem.icon} />}
                      <span>{navItem.title}</span>
                    </Link>
                  </Button>
                )
              })}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        
        {/* Recent Searches Section */}
        {recentSearches && recentSearches.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex-shrink-0">Recent</SidebarGroupLabel>
            <SidebarGroupContent className="overflow-auto">
              <SidebarMenu>
                <RecentSearches searches={recentSearches} currentPath={pathname} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        
        {/* Render remaining groups (Organization, etc.) */}
        {data.navMain.slice(1).map((item, index) => (
          <SidebarGroup key={item.title || `group-${index + 1}`}>
            {item.title && <SidebarGroupLabel>{item.title}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {item.items.map((navItem) => {
                  const active = !navItem.disabled && isPathActive(pathname, navItem.url)
                  const hasSubItems = navItem.items && navItem.items.length > 0
                  
                  return (
                    <Collapsible key={navItem.title} asChild defaultOpen={hasSubItems}>
                      <SidebarMenuItem>
                        <SidebarMenuButton 
                          asChild={!navItem.disabled}
                          isActive={active}
                          disabled={navItem.disabled}
                          tooltip={navItem.title}
                          className={navItem.disabled ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          {navItem.disabled ? (
                            <>
                              {navItem.icon && <Icon name={navItem.icon} />}
                              <span>{navItem.title}</span>
                            </>
                          ) : (
                            <Link href={navItem.url} aria-current={active ? "page" : undefined} prefetch>
                              {navItem.icon && <Icon name={navItem.icon} />}
                              <span>{navItem.title}</span>
                            </Link>
                          )}
                        </SidebarMenuButton>
                        
                        {/* Render collapsible sub-items */}
                        {hasSubItems && (
                          <>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuAction className="data-[state=open]:rotate-90">
                                <Icon name="chevron-right" />
                                <span className="sr-only">Toggle {navItem.title}</span>
                              </SidebarMenuAction>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <SidebarMenuSub>
                                {navItem.items?.map((subItem) => {
                                  const subActive = !subItem.disabled && isPathActive(pathname, subItem.url)
                                  const isAllJobs = subItem.title === "All Jobs"
                                  return (
                                    <SidebarMenuSubItem key={subItem.title}>
                                      {subItem.fullTitle ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <SidebarMenuSubButton 
                                              asChild={!subItem.disabled}
                                              isActive={subActive}
                                              className={(subItem.disabled ? "opacity-50 cursor-not-allowed" : "") + (isAllJobs ? " text-muted-foreground" : "")}
                                            >
                                              {subItem.disabled ? (
                                                <>
                                                  {subItem.icon && <Icon name={subItem.icon} />}
                                                  <span>{subItem.title}</span>
                                                </>
                                              ) : (
                                                <Link href={subItem.url} aria-current={subActive ? "page" : undefined} prefetch className={isAllJobs ? "text-muted-foreground" : undefined}>
                                                  {subItem.icon && <Icon name={subItem.icon} /> }
                                                  <span>{subItem.title}</span>
                                                </Link>
                                              )}
                                            </SidebarMenuSubButton>
                                          </TooltipTrigger>
                                          <TooltipContent side="right">
                                            <p>{subItem.fullTitle}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <SidebarMenuSubButton 
                                          asChild={!subItem.disabled}
                                          isActive={subActive}
                                          className={(subItem.disabled ? "opacity-50 cursor-not-allowed" : "") + (isAllJobs ? " text-muted-foreground" : "")}
                                        >
                                          {subItem.disabled ? (
                                            <>
                                              {subItem.icon && <Icon name={subItem.icon} />}
                                              <span>{subItem.title}</span>
                                            </>
                                          ) : (
                                            <Link href={subItem.url} aria-current={subActive ? "page" : undefined} prefetch className={isAllJobs ? "text-muted-foreground" : undefined}>
                                              {subItem.icon && <Icon name={subItem.icon} /> }
                                              <span>{subItem.title}</span>
                                            </Link>
                                          )}
                                        </SidebarMenuSubButton>
                                      )}
                                    </SidebarMenuSubItem>
                                  )
                                })}
                              </SidebarMenuSub>
                            </CollapsibleContent>
                          </>
                        )}
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        {activeOrganization && activeOrganization.credits !== undefined && (
          <CreditBalance credits={activeOrganization.credits} currentPlan={subscription?.plan as "starter" | "pro" | "enterprise" | null | undefined} />
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setSupportModalOpen(true)}
              tooltip="Support"
            >
              <Icon name="lifebuoy" />
              <span>Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Home page">
              <a href="https://heyhire.ai" target="_blank" rel="noopener noreferrer">
                <Icon name="home" />
                <span>Home page</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser user={user} />
      </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SupportModal open={supportModalOpen} onOpenChange={setSupportModalOpen} />
    </TooltipProvider>
  )
} 