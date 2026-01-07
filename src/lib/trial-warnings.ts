import { getCreditsUsageForPeriod } from "@/actions/credits"
import { PLAN_LIMITS } from "@/types/plans"

/**
 * Calculate trial usage warning for a subscription
 * Returns trial warning data if user should see a warning (80%+ usage)
 */
export async function getTrialWarning(subscription: any, organizationId: string) {
  if (subscription?.status !== "trialing" || !subscription.plan) {
    return null
  }

  const start = subscription.periodStart
  const end = subscription.periodEnd

  if (!start || !end) return null

  const result = await getCreditsUsageForPeriod({
    organizationId,
    startDate: new Date(start),
    endDate: new Date(end),
  })

  if (result.error) return null

  const limit = PLAN_LIMITS[subscription.plan as keyof typeof PLAN_LIMITS]?.trialCredits || 100
  const usageRatio = result.used / limit

  // Show warning at 80% or 100%
  return usageRatio >= 0.8 ? { used: result.used, limit } : null
}
