/**
 * Subscription State Machine
 * Validates subscription status transitions
 */

export type SubscriptionStatus =
    | "incomplete"
    | "incomplete_expired"
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "paused";

/**
 * Valid status transitions based on Stripe subscription lifecycle
 * https://stripe.com/docs/billing/subscriptions/overview#subscription-statuses
 */
const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    incomplete: ["active", "incomplete_expired", "canceled"],
    incomplete_expired: [], // Terminal state
    trialing: ["active", "past_due", "canceled", "unpaid"],
    active: ["past_due", "canceled", "unpaid", "paused", "trialing"],
    past_due: ["active", "canceled", "unpaid"],
    canceled: [], // Terminal state
    unpaid: ["active", "canceled"],
    paused: ["active", "canceled"],
};

/**
 * Active statuses - user can access the product
 */
export const ACTIVE_STATUSES: SubscriptionStatus[] = ["active", "trialing"];

/**
 * Inactive statuses - access should be revoked
 */
export const INACTIVE_STATUSES: SubscriptionStatus[] = [
    "canceled",
    "unpaid",
    "incomplete_expired",
];

/**
 * At-risk statuses - payment issues but still active
 */
export const AT_RISK_STATUSES: SubscriptionStatus[] = ["past_due", "paused"];

/**
 * Check if a transition is valid
 */
export function canTransition(
    from: SubscriptionStatus | null,
    to: SubscriptionStatus
): boolean {
    if (!from) return true; // New subscription
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if status is active
 */
export function isActive(status: SubscriptionStatus | string | null): boolean {
    return ACTIVE_STATUSES.includes(status as SubscriptionStatus);
}

/**
 * Check if status is inactive
 */
export function isInactive(status: SubscriptionStatus | string | null): boolean {
    return INACTIVE_STATUSES.includes(status as SubscriptionStatus);
}

/**
 * Check if status is at risk
 */
export function isAtRisk(status: SubscriptionStatus | string | null): boolean {
    return AT_RISK_STATUSES.includes(status as SubscriptionStatus);
}

/**
 * Get human-readable status name
 */
export function getStatusLabel(status: SubscriptionStatus): string {
    const labels: Record<SubscriptionStatus, string> = {
        incomplete: "Incomplete",
        incomplete_expired: "Expired",
        trialing: "Trial",
        active: "Active",
        past_due: "Past Due",
        canceled: "Canceled",
        unpaid: "Unpaid",
        paused: "Paused",
    };
    return labels[status] || status;
}

/**
 * Determine if credits should be granted for this status
 */
export function shouldGrantCredits(status: SubscriptionStatus): boolean {
    return isActive(status);
}

/**
 * Determine if credits should be revoked for this status
 */
export function shouldRevokeCredits(status: SubscriptionStatus): boolean {
    return isInactive(status) || status === "past_due";
}
