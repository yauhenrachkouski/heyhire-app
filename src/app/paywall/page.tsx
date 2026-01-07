import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Image from "next/image"
import { SubscribeCardsServer, SubscribeHeader } from "@/components/subscribe/subscribe-cards"
import { requireActiveSubscription } from "@/actions/stripe"
import { getTrialEligibility } from "@/actions/subscription"
import { getPostHogServer } from "@/lib/posthog/posthog-server"
import heyhireLogo from "@/assets/heyhire_logo.svg"

// Always render fresh, never cache the subscribe page
export const dynamic = "force-dynamic"

export default async function PaywallPage() {
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

  const { isTrialEligible } = await getTrialEligibility()

  // Track paywall view for funnel analysis
  const activeOrgId = session.session.activeOrganizationId
  getPostHogServer().capture({
    distinctId: session.user.id,
    event: "paywall_viewed",
    ...(activeOrgId && { groups: { organization: activeOrgId } }),
    properties: {
      is_trial_eligible: isTrialEligible,
    },
  })

  return (
    <div className="flex min-h-svh flex-col p-6 md:p-10">
      <div className="flex justify-center gap-2 md:justify-start mb-8">
        <a href="/" className="flex items-center gap-2 font-medium">
          <Image
            src={heyhireLogo}
            alt="HeyHire"
            width={100}
            height={25}
          />
        </a>
      </div>
      <div className="flex flex-1 justify-center pt-[10svh]">
        <div className="w-full max-w-4xl">
          <SubscribeHeader isRequired={true} isTrialEligible={isTrialEligible} />
          <SubscribeCardsServer isRequired={true} isTrialEligible={isTrialEligible} showSupportSections />
        </div>
      </div>
    </div>
  )
}
