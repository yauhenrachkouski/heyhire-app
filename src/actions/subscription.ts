"use server"

import { log } from "@/lib/axiom/server-log";

const LOG_SOURCE = "actions/subscription";

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

export async function hasUsedTrial() {
  const eligibility = await getTrialEligibility()
  return {
    hasUsed: !eligibility.isTrialEligible,
    error: null as string | null,
    reason: eligibility.reason,
  }
}

export async function isInTrialPeriod() {
  try {
    const { activeOrgId } = await getSessionWithOrg()

    const orgSubscription = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, activeOrgId))
      .limit(1)

    if (!orgSubscription[0]) {
      return { inTrial: false, error: null as string | null }
    }

    const sub = orgSubscription[0]
    const now = new Date()
    const inTrial =
      sub.status === "trialing" ||
      (!!sub.trialEnd && new Date(sub.trialEnd).getTime() > now.getTime())

    return {
      inTrial,
      trialEnd: sub.trialEnd,
      error: null as string | null,
    }
  } catch (error) {
    log.error(LOG_SOURCE, "check_trial.error", { error })
    return {
      inTrial: false,
      error: error instanceof Error ? error.message : "Failed to check trial period",
    }
  }
}

export async function getTrialDaysRemaining() {
  const { inTrial, trialEnd } = await isInTrialPeriod()

  if (!inTrial || !trialEnd) {
    return { daysRemaining: 0, error: null as string | null }
  }

  const now = new Date()
  const end = new Date(trialEnd)
  const diffTime = end.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return {
    daysRemaining: Math.max(0, diffDays),
    trialEnd,
    error: null as string | null,
  }
}

export async function getTrialStatus() {
  const eligibility = await getTrialEligibility()
  const { inTrial, trialEnd } = await isInTrialPeriod()
  const { daysRemaining } = await getTrialDaysRemaining()

  return {
    isTrialEligible: eligibility.isTrialEligible,
    inTrial,
    hasUsedTrial: !eligibility.isTrialEligible,
    daysRemaining,
    trialEnd,
    reason: eligibility.reason,
    error: null as string | null,
  }
}
