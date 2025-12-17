import { db } from "@/db/drizzle";
import { subscription as subscriptionTable, organization } from "@/db/schema";
import { eq } from "drizzle-orm";
import { addCredits, setCreditsBalance } from "@/actions/credits";
import { getPlanCreditAllocation, CREDIT_TYPES } from "@/lib/credits";

// =============================================================================
// TYPES
// =============================================================================

export interface GrantCreditsParams {
    organizationId: string;
    userId: string;
    plan: string;
    subscriptionId?: string;
    resetBalance?: boolean;
    metadata?: Record<string, unknown>;
}

export interface RevokeCreditsParams {
    organizationId: string;
    userId: string;
    subscriptionId?: string;
    reason: string;
    metadata?: Record<string, unknown>;
}

// =============================================================================
// SUBSCRIPTION QUERIES
// =============================================================================

/**
 * Get subscription for an organization - SINGLE SOURCE OF TRUTH
 */
export async function getOrgSubscription(organizationId: string) {
    return db.query.subscription.findFirst({
        where: eq(subscriptionTable.referenceId, organizationId),
    });
}

/**
 * Get subscription by Stripe customer ID (fallback for legacy data)
 */
export async function getSubscriptionByCustomerId(stripeCustomerId: string) {
    return db.query.subscription.findFirst({
        where: eq(subscriptionTable.stripeCustomerId, stripeCustomerId),
    });
}

// =============================================================================
// CREDITS OPERATIONS
// =============================================================================

/**
 * Grant credits for a subscription plan
 * Used on subscription creation and renewal
 */
export async function grantPlanCredits(params: GrantCreditsParams) {
    const {
        organizationId,
        userId,
        plan,
        subscriptionId,
        resetBalance = false,
        metadata = {},
    } = params;

    const contactLookupCredits = getPlanCreditAllocation(plan, CREDIT_TYPES.CONTACT_LOOKUP);

    if (contactLookupCredits <= 0) {
        console.log(`[Subscription] No credits to grant for plan: ${plan}`);
        return null;
    }

    const description = resetBalance
        ? `Subscription monthly reset: ${contactLookupCredits} contact lookup credits for ${plan} plan`
        : `${plan} purchase: ${contactLookupCredits} contact lookup credits`;

    const creditFn = resetBalance ? setCreditsBalance : addCredits;
    const creditParams = resetBalance
        ? {
            organizationId,
            userId,
            newBalance: contactLookupCredits,
            type: "subscription_grant" as const,
            creditType: CREDIT_TYPES.CONTACT_LOOKUP,
            relatedEntityId: subscriptionId,
            description,
            metadata: { plan, subscriptionId, ...metadata },
        }
        : {
            organizationId,
            userId,
            amount: contactLookupCredits,
            type: "subscription_grant" as const,
            creditType: CREDIT_TYPES.CONTACT_LOOKUP,
            relatedEntityId: subscriptionId,
            description,
            metadata: { plan, subscriptionId, ...metadata },
        };

    const result = await creditFn(creditParams as any);

    if (result.success) {
        console.log(`[Subscription] ✅ Granted ${contactLookupCredits} credits for ${plan} plan`);
    } else {
        console.error(`[Subscription] ❌ Failed to grant credits:`, result.error);
    }

    return result;
}

/**
 * Revoke all credits for an organization
 * Used when subscription becomes inactive
 */
export async function revokeCredits(params: RevokeCreditsParams) {
    const { organizationId, userId, subscriptionId, reason, metadata = {} } = params;

    const result = await setCreditsBalance({
        organizationId,
        userId,
        newBalance: 0,
        type: "subscription_grant",
        creditType: CREDIT_TYPES.CONTACT_LOOKUP,
        relatedEntityId: subscriptionId,
        description: reason,
        metadata,
    });

    if (result.success) {
        console.log(`[Subscription] ✅ Revoked credits: ${reason}`);
    } else {
        console.error(`[Subscription] ❌ Failed to revoke credits:`, result.error);
    }

    return result;
}

// =============================================================================
// SUBSCRIPTION STATUS HELPERS
// =============================================================================

export type SubscriptionStatus =
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "paused"
    | "unpaid";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["active", "trialing"];
const INACTIVE_STATUSES: SubscriptionStatus[] = ["canceled", "unpaid", "incomplete_expired"];

/**
 * Check if a subscription status is considered active
 */
export function isStatusActive(status: string | null): boolean {
    return ACTIVE_STATUSES.includes(status as SubscriptionStatus);
}

/**
 * Check if a subscription status is considered inactive
 */
export function isStatusInactive(status: string | null): boolean {
    return INACTIVE_STATUSES.includes(status as SubscriptionStatus);
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
