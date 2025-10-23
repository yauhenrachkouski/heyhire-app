"use server"

import { headers as getHeaders } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithOrg } from "@/lib/auth-helpers"

/**
 * Server action to initiate subscription checkout
 * Calls better-auth's subscription upgrade endpoint and redirects user to Stripe
 */
export async function initiateSubscriptionCheckout(formData: FormData) {
  const plan = formData.get("plan") as string
  
  console.log('[initiateSubscriptionCheckout] Starting checkout for plan:', plan)

  if (!plan || (plan !== "starter" && plan !== "pro")) {
    throw new Error("Invalid plan selected")
  }

  // Get authenticated session and active organization
  const { activeOrgId, userId } = await getSessionWithOrg()
  
  console.log('[initiateSubscriptionCheckout] User and org:', { userId, activeOrgId })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  
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
      successUrl: `${siteUrl}/subscribe/success`,
      cancelUrl: `${siteUrl}/subscribe`,
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
 * Server action to redirect to billing portal
 */
export async function redirectToBillingPortal() {
  const { activeOrgId } = await getSessionWithOrg()
  
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  
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

