import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { log } from "@/lib/axiom/server-log";
import { TooltipProvider } from "@/components/ui/tooltip"
import { PersistentSidebarProvider } from "@/providers/sidebar-provider"
import { PlansModalProvider } from "@/providers/plans-modal-provider"
import { requireActiveSubscription, getUserSubscription } from "@/actions/stripe"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { getRecentSearches } from "@/actions/search"
import { getOrganizationCredits } from "@/actions/credits"
import { getTrialWarning } from "@/lib/trial-warnings"

export default async function DashboardLayout({
  children,
  breadcrumbs,
  params,
}: {
  children: React.ReactNode
  breadcrumbs: React.ReactNode
  params: Promise<{ org: string }>
}) {
  const { org } = await params
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

  if (!activeOrganization) {
    return redirect("/onboarding")
  }

  if (activeOrganization.id !== org) {
    return redirect(`/${activeOrganization.id}`)
  }

  // Fetch recent searches if we have an active organization
  const recentSearchesResponse = activeOrganization
    ? await getRecentSearches(activeOrganization.id, 10)
    : { success: false, data: [] }
  const recentSearches = recentSearchesResponse.success ? recentSearchesResponse.data : []

  // Debug: Log what we received from better-auth APIs
  log.info("DashboardLayout", "Organizations data", {
    organizationsCount: organizations?.length ?? 0,
    organizationsList: organizations?.map(o => ({ id: o.id, name: o.name })) ?? [],
    activeOrgId: activeOrganization?.id,
    activeOrgName: activeOrganization?.name,
    currentUserId: activeMember?.user?.id,
    currentUserRole: activeMember?.role,
    hasSubscription: !!subscription
  })

  // Fetch credits for active organization and create extended type
  let activeOrgWithCredits: (typeof activeOrganization & { credits?: number }) | null = activeOrganization;
  let trialWarning: { used: number; limit: number } | null = null;
  
  if (activeOrganization) {
    const credits = await getOrganizationCredits(activeOrganization.id);
    activeOrgWithCredits = { ...activeOrganization, credits } as typeof activeOrganization & { credits: number };

    // Check trial usage for warnings
    trialWarning = await getTrialWarning(subscription, activeOrganization.id);
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
            trialWarning={trialWarning}
          />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear bg-background border-b group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
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
 
