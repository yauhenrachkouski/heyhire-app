"use client"

import * as React from "react"
import { OrganizationSwitcher } from "@/components/sidebar/organization-switcher"
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
import Link from "next/link"
import { usePathname } from "next/navigation"

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

// Navigation data for Heyhire recruitment platform
// Disabled items show but are not clickable until implemented
const data: { navMain: NavGroup[] } = {
  navMain: [
    {
      url: "#",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: "dashboard" as IconName,
        },
      ],
    },
    
    
    // {
    //   title: "Settings",
    //   url: "#",
    //   items: [     
      
    //     {
    //       title: "Integrations",
    //       url: "/settings/integrations",
    //       icon: "plug" as IconName,
    //       disabled: false,
    //     },
    //   ],
    // },
  ],
}

function isPathActive(currentPathname: string, itemUrl: string): boolean {
  if (itemUrl === "/") return currentPathname === "/"
  
  // Special case for /jobs - only active when exactly on /jobs, not on individual job pages
  if (itemUrl === "/jobs") {
    return currentPathname === "/jobs"
  }
  
  return currentPathname === itemUrl || currentPathname.startsWith(`${itemUrl}/`)
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  // Generate dynamic navigation data with recent job

  return (
    <TooltipProvider>
      <Sidebar {...props} collapsible="icon">
      <SidebarHeader>
        <OrganizationSwitcher />
      </SidebarHeader>
      <SidebarContent>
        {/* We create a SidebarGroup for each parent. */}
        {data.navMain.map((item, index) => (
          <SidebarGroup key={item.title || `group-${index}`}>
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
        <NavUser />
      </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </TooltipProvider>
  )
} 