"use server";

import { getSessionWithOrg } from "@/lib/auth-helpers";
import { db } from "@/db/drizzle";
import { subscription } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Check if the organization has already used their trial
 */
export async function hasUsedTrial() {
  try {
    const { activeOrgId } = await getSessionWithOrg();

    // Check if organization has any subscription record with paid status
    const orgSubscriptions = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, activeOrgId));

    // Only count subscriptions with completed/paid statuses as "used"
    // Exclude incomplete, incomplete_expired statuses which are pending payment
    const paidStatuses = ["trialing", "active", "past_due", "paused"];
    const hasUsed = orgSubscriptions.some((sub) =>
      sub.status && paidStatuses.includes(sub.status)
    );

    return { hasUsed, error: null };
  } catch (error) {
    console.error("Error checking trial status:", error);
    return { hasUsed: false, error: error instanceof Error ? error.message : "Failed to check trial status" };
  }
}

/**
 * Check if organization is currently in trial period
 */
export async function isInTrialPeriod() {
  try {
    const { activeOrgId } = await getSessionWithOrg();

    const orgSubscription = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, activeOrgId))
      .limit(1);

    if (!orgSubscription[0]) {
      return { inTrial: false, error: null };
    }

    const sub = orgSubscription[0];
    const inTrial = sub.status === "trialing";

    return {
      inTrial,
      trialEnd: sub.trialEnd,
      error: null,
    };
  } catch (error) {
    console.error("Error checking trial period:", error);
    return { inTrial: false, error: error instanceof Error ? error.message : "Failed to check trial period" };
  }
}

/**
 * Get days remaining in trial
 */
export async function getTrialDaysRemaining() {
  const { inTrial, trialEnd } = await isInTrialPeriod();

  if (!inTrial || !trialEnd) {
    return { daysRemaining: 0, error: null };
  }

  const now = new Date();
  const end = new Date(trialEnd);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return {
    daysRemaining: Math.max(0, diffDays),
    trialEnd,
    error: null,
  };
}

/**
 * Get trial status with helpful information
 */
export async function getTrialStatus() {
  const { hasUsed } = await hasUsedTrial();
  const { inTrial, trialEnd } = await isInTrialPeriod();
  const { daysRemaining } = await getTrialDaysRemaining();

  return {
    eligible: !hasUsed, // Eligible for trial if never used
    inTrial,
    hasUsedTrial: hasUsed,
    daysRemaining,
    trialEnd,
    error: null,
  };
}

