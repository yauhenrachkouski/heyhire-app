import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { SubscribeCardsServer } from "@/components/subscribe/subscribe-cards-server"
import { requireActiveSubscription, getUserSubscription } from "@/actions/stripe"
import { hasUsedTrial } from "@/actions/trial"
import { AppSidebar } from "@/components/sidebar/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { PersistentSidebarProvider } from "@/providers/sidebar-provider"
import { getRecentSearches } from "@/actions/search"

// Always render fresh, never cache the subscribe page
export const dynamic = "force-dynamic"

export default async function SubscribePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return redirect("/auth/signin")
  }

  // Check if user already has an active subscription
  const { hasSubscription } = await requireActiveSubscription()
  
  if (hasSubscription) {
    // User already has active subscription, redirect to app
    return redirect("/")
  }

  // Check if user has used their trial
  const { hasUsed: trialUsed } = await hasUsedTrial()

  // Fetch sidebar data just like protected layout does
  const [{ subscription }, organizations, activeOrganization] = await Promise.all([
    getUserSubscription(),
    auth.api.listOrganizations({ headers: await headers() }),
    auth.api.getFullOrganization({ headers: await headers() }),
  ])

  // Debug: Log what we received from better-auth APIs
  console.log('[SubscribePage] Organizations data:', {
    organizationsCount: organizations?.length ?? 0,
    organizationsList: organizations?.map(o => ({ id: o.id, name: o.name })) ?? [],
    activeOrgId: activeOrganization?.id,
    activeOrgName: activeOrganization?.name,
    sessionUserId: session?.user?.id,
    sessionActiveOrgId: session?.session?.activeOrganizationId,
    hasSubscription: !!subscription
  })

  // Fetch recent searches if we have an active organization
  const recentSearchesResponse = activeOrganization 
    ? await getRecentSearches(activeOrganization.id, 10)
    : { success: false, data: [] };
  const recentSearches = recentSearchesResponse.success ? recentSearchesResponse.data : [];

  return (
    <TooltipProvider>
      <PersistentSidebarProvider>
        <AppSidebar 
          subscription={subscription}
          organizations={organizations}
          activeOrganization={activeOrganization}
          user={session?.user ?? null}
          recentSearches={recentSearches ?? []}
        />
        <SidebarInset>
          <div className="flex flex-1 flex-col items-center justify-center p-4 md:p-8">
            {/* Subscribe cards */}
            <SubscribeCardsServer isRequired={true} trialEligible={!trialUsed} />
          </div>
        </SidebarInset>
      </PersistentSidebarProvider>
    </TooltipProvider>
  )
}
