"use server"

import { headers as getHeaders } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithOrg } from "@/lib/auth-helpers"
import { db } from "@/db/drizzle"
import { subscription } from "@/db/schema"
import { user } from "@/db/schema"
import { eq } from "drizzle-orm"
import { stripeClient } from "@/lib/auth"

/**
 * Server action to initiate subscription checkout
 * Calls better-auth's subscription upgrade endpoint and redirects user to Stripe
 */
export async function initiateSubscriptionCheckout(formData: FormData) {
  const plan = formData.get("plan") as string
  
  console.log('[initiateSubscriptionCheckout] Starting checkout for plan:', plan)

  if (!plan || plan !== "standard") {
    throw new Error("Invalid plan selected")
  }

  // Get authenticated session and active organization
  const { activeOrgId, userId } = await getSessionWithOrg()
  
  console.log('[initiateSubscriptionCheckout] User and org:', { userId, activeOrgId })

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  
  console.log('[initiateSubscriptionCheckout] Calling better-auth subscription API:', {
    plan,
    referenceId: activeOrgId,
  })

  // Call better-auth's subscription upgrade endpoint
  // This ensures better-auth handles the subscription creation properly
  const headers = await getHeaders()
  const cookie = headers.get("cookie") || ""
  
  const response = await fetch(`${siteUrl}/api/auth/subscription/upgrade`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie,
    },
    body: JSON.stringify({
      plan: plan,
      referenceId: activeOrgId,
      successUrl: `${siteUrl}/paywall/success`,
      cancelUrl: `${siteUrl}/paywall`,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[initiateSubscriptionCheckout] Error from better-auth:', error)
    throw new Error("Failed to create checkout session")
  }

  const data = await response.json()
  console.log('[initiateSubscriptionCheckout] Response from better-auth:', data)

  // Redirect to Stripe checkout
  if (data.url) {
    console.log('[initiateSubscriptionCheckout] Redirecting to Stripe:', data.url)
    redirect(data.url)
  } else {
    console.error('[initiateSubscriptionCheckout] No checkout URL received')
    throw new Error("Failed to get checkout URL")
  }
}

/**
 * Server action to initiate one-time trial checkout
 * Uses Stripe Checkout (mode=payment). Trial is available once per organization.
 */
export async function initiateTrialCheckout() {
  const { activeOrgId, userId } = await getSessionWithOrg()

  const orgSubscriptions = await db
    .select({ status: subscription.status })
    .from(subscription)
    .where(eq(subscription.referenceId, activeOrgId))

  const paidStatuses = ["trialing", "active", "past_due", "paused"]
  const trialAlreadyUsed = orgSubscriptions.some((s) => s.status && paidStatuses.includes(s.status))
  if (trialAlreadyUsed) {
    throw new Error("Trial already used")
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"

  const trialPriceId = process.env.STRIPE_TRIAL_PRICE_ID
  if (!trialPriceId) {
    throw new Error("Missing STRIPE_TRIAL_PRICE_ID")
  }

  const userRecord = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { stripeCustomerId: true },
  })

  const session = await stripeClient.checkout.sessions.create({
    mode: "payment",
    customer: userRecord?.stripeCustomerId ?? undefined,
    payment_method_collection: "always",
    line_items: [{ price: trialPriceId, quantity: 1 }],
    success_url: `${baseUrl}/paywall/success`,
    cancel_url: `${baseUrl}/paywall`,
    client_reference_id: activeOrgId,
    metadata: {
      plan: "trial",
      referenceId: activeOrgId,
      userId,
    },
  })

  if (!session.url) {
    throw new Error("Failed to create checkout session")
  }

  redirect(session.url)
}

/**
 * Server action to redirect to billing portal
 */
export async function redirectToBillingPortal() {
  const { activeOrgId } = await getSessionWithOrg()
  
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  
  console.log('[redirectToBillingPortal] Getting billing portal for org:', activeOrgId)

  // Call better-auth's billing portal endpoint
  const headers = await getHeaders()
  const cookie = headers.get("cookie") || ""
  
  const response = await fetch(`${siteUrl}/api/auth/subscription/billing-portal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie,
    },
    body: JSON.stringify({
      referenceId: activeOrgId,
      returnUrl: `${siteUrl}/billing`,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('[redirectToBillingPortal] Error from better-auth:', error)
    throw new Error("Failed to access billing portal")
  }

  const data = await response.json()
  console.log('[redirectToBillingPortal] Response from better-auth:', data)

  // Redirect to Stripe billing portal
  if (data.url) {
    console.log('[redirectToBillingPortal] Redirecting to Stripe billing portal:', data.url)
    redirect(data.url)
  } else {
    console.error('[redirectToBillingPortal] No portal URL received')
    throw new Error("Failed to get billing portal URL")
  }
}

