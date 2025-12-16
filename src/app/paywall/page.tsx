import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import Image from "next/image"
import { SubscribeCardsServer, SubscribeHeader } from "@/components/subscribe/subscribe-cards"
import { requireActiveSubscription } from "@/actions/stripe"
import { hasUsedTrial } from "@/actions/trial"
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

  // Check if user has used their trial
  const { hasUsed: trialUsed } = await hasUsedTrial()

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
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-4xl">
          <SubscribeHeader isRequired={true} trialEligible={!trialUsed} />
          <SubscribeCardsServer isRequired={true} trialEligible={!trialUsed} showSupportSections />
        </div>
      </div>
    </div>
  )
}
