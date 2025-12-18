import { db } from "@/db/drizzle";
import { subscription as subscriptionTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { type SubscriptionStatus, isActive, isInactive, isAtRisk } from "./state-machine";

export {
    type SubscriptionStatus,
    isActive as isStatusActive,
    isInactive as isStatusInactive,
    isAtRisk as isStatusAtRisk,
    shouldGrantCredits,
    shouldRevokeCredits,
    ACTIVE_STATUSES,
    INACTIVE_STATUSES,
    AT_RISK_STATUSES,
} from "./state-machine";

/**
 * Get subscription for an organization - SINGLE SOURCE OF TRUTH
 */
export async function getOrgSubscription(organizationId: string) {
    return db.query.subscription.findFirst({
        where: eq(subscriptionTable.referenceId, organizationId),
    });
}

/**
 * Check if organization has trial eligibility
 */
export async function isTrialEligible(organizationId: string): Promise<boolean> {
    const orgSubscriptions = await db
        .select({ status: subscriptionTable.status })
        .from(subscriptionTable)
        .where(eq(subscriptionTable.referenceId, organizationId));

    const paidStatuses = ["trialing", "active", "past_due", "paused"];
    return !orgSubscriptions.some((s) => s.status && paidStatuses.includes(s.status));
}

/**
 * Check if organization has active subscription
 */
export async function hasActiveSubscription(organizationId: string): Promise<boolean> {
    const sub = await getOrgSubscription(organizationId);
    if (!sub) return false;
    return isActive(sub.status as SubscriptionStatus);
}
