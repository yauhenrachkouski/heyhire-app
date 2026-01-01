import Link from "next/link"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { eq, desc } from "drizzle-orm"

import { validateAndTrackShareToken, validateShareToken } from "@/actions/share-links"
import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { hashShareToken } from "@/lib/demo"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PersistentSidebarProvider } from "@/providers/sidebar-provider"
import { PreviewSidebar } from "./preview-sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface PreviewDashboardLayoutProps {
  token: string
  children: React.ReactNode
}

export async function PreviewDashboardLayout({
  token,
  children,
}: PreviewDashboardLayoutProps) {
  const cookieStore = await cookies()
  const isFirstVisit = cookieStore.get("hh_preview_first")?.value === "1"

  let organizationId: string

  try {
    // Only track view count on first visit to this token
    if (isFirstVisit) {
      const result = await validateAndTrackShareToken(token)
      organizationId = result.organizationId
    } else {
      const result = await validateShareToken(token)
      organizationId = result.organizationId
    }
  } catch {
    notFound()
  }

  // Fetch organization details
  const org = await db.query.organization.findFirst({
    where: eq(schema.organization.id, organizationId),
    columns: { id: true, name: true },
  })

  if (!org) notFound()

  // Fetch recent searches for sidebar (preview-safe)
  const searches = await db
    .select({
      id: schema.search.id,
      name: schema.search.name,
    })
    .from(schema.search)
    .where(eq(schema.search.organizationId, organizationId))
    .orderBy(desc(schema.search.createdAt))
    .limit(10)

  return (
    <TooltipProvider>
      <PersistentSidebarProvider>
        <PreviewSidebar
          token={token}
          organizationName={org.name}
          recentSearches={searches}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear bg-background border-b group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex h-full flex-1 items-center justify-between gap-2 px-4 leading-none">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 my-auto block shrink-0 data-[orientation=vertical]:h-4"
                />
                <Badge variant="secondary" className="font-normal">
                  Preview Mode (read-only)
                </Badge>
              </div>
              <Button asChild size="sm">
                <Link href="/auth/signin">Sign up to interact</Link>
              </Button>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
        </SidebarInset>
      </PersistentSidebarProvider>
    </TooltipProvider>
  )
}



