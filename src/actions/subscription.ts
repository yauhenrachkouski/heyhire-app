"use server"

import { getSessionWithOrg } from "@/lib/auth-helpers"
import { db } from "@/db/drizzle"
import { subscription } from "@/db/schema"
import { count, eq } from "drizzle-orm"

export async function getTrialEligibility() {
  const { activeOrgId } = await getSessionWithOrg()

  const [{ count: subscriptionCountRaw } = { count: 0 }] = await db
    .select({ count: count() })
    .from(subscription)
    .where(eq(subscription.referenceId, activeOrgId))

  const subscriptionCount = Number(subscriptionCountRaw ?? 0)
  if (subscriptionCount > 0) {
    return {
      isTrialEligible: false,
      reason: "has_subscription" as const,
      subscriptionCount,
      orgCreatedAt: null as Date | null,
    }
  }

  return {
    isTrialEligible: true,
    reason: null as null,
    subscriptionCount,
    orgCreatedAt: null as Date | null,
  }
}

