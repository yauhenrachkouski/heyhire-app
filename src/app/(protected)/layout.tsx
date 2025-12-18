import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PersistentSidebarProvider } from "@/providers/sidebar-provider"
import { PlansModalProvider } from "@/providers/plans-modal-provider"
import { requireActiveSubscription, getUserSubscription } from "@/actions/stripe"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { getRecentSearches } from "@/actions/search"
import { getOrganizationCredits } from "@/actions/credits"

export default async function DashboardLayout({
  children,
  breadcrumbs,
}: {
  children: React.ReactNode
  breadcrumbs: React.ReactNode
}) {
  // Check if organization has active subscription
  const { shouldRedirect, redirectTo } = await requireActiveSubscription()

  if (shouldRedirect && redirectTo) {
    return redirect(redirectTo)
  }

  // Fetch all sidebar data in parallel for better performance
  const [{ subscription }, organizations, activeOrganization, activeMember] = await Promise.all([
    getUserSubscription(),
    auth.api.listOrganizations({ headers: await headers() }),
    auth.api.getFullOrganization({ headers: await headers() }),
    auth.api.getActiveMember({ headers: await headers() })
  ])

  // Debug: Log what we received from better-auth APIs
  console.log('[DashboardLayout] Organizations data:', {
    organizationsCount: organizations?.length ?? 0,
    organizationsList: organizations?.map(o => ({ id: o.id, name: o.name })) ?? [],
    activeOrgId: activeOrganization?.id,
    activeOrgName: activeOrganization?.name,
    currentUserId: activeMember?.user?.id,
    currentUserRole: activeMember?.role,
    hasSubscription: !!subscription
  })

  // Fetch recent searches if we have an active organization
  const recentSearchesResponse = activeOrganization 
    ? await getRecentSearches(activeOrganization.id, 10)
    : { success: false, data: [] };
  const recentSearches = recentSearchesResponse.success ? recentSearchesResponse.data : [];

  // Fetch credits for active organization and create extended type
  let activeOrgWithCredits: (typeof activeOrganization & { credits?: number }) | null = activeOrganization;
  if (activeOrganization) {
    const credits = await getOrganizationCredits(activeOrganization.id);
    activeOrgWithCredits = { ...activeOrganization, credits } as typeof activeOrganization & { credits: number };
  }

  return (
    <TooltipProvider>
      <PlansModalProvider>
        <PersistentSidebarProvider>
          <AppSidebar 
            subscription={subscription}
            organizations={organizations}
            activeOrganization={activeOrgWithCredits}
            user={activeMember?.user ?? null}
            recentSearches={recentSearches ?? []}
          />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear bg-background border-b">
              <div className="flex h-full items-center gap-2 px-4 leading-none">
                <SidebarTrigger className="-ml-1" />
                <Separator
                orientation="vertical"
                className="mr-2 my-auto block shrink-0 data-[orientation=vertical]:h-4"
              />
                <div className="flex items-center min-w-0">
                  {breadcrumbs}
                </div>
              </div>
            </header>
            <div className="flex flex-1 flex-col gap-4 p-4">
              {children}
            </div>
          </SidebarInset>
        </PersistentSidebarProvider>
      </PlansModalProvider>
    </TooltipProvider>
  )
}
 