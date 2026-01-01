import { subscription } from "@/db/schema";

type SubscriptionStatus = 
  | "active" 
  | "trialing" 
  | "past_due" 
  | "canceled" 
  | "incomplete" 
  | "incomplete_expired" 
  | "paused"
  | "none";

interface SubscriptionStatusInfo {
  status: SubscriptionStatus;
  isActive: boolean;
  display: string;
  needsAction: boolean;
}

/**
 * Check if a subscription is active (can use the service)
 */
export function isSubscriptionActive(
  sub: typeof subscription.$inferSelect | null | undefined
): boolean {
  if (!sub) return false;
  const activeStatuses: SubscriptionStatus[] = ["active", "trialing"];
  const status = (sub.status as SubscriptionStatus) || "none";

  if (!activeStatuses.includes(status)) return false;

  return true;
}

/**
 * Get detailed subscription status information
 */
export function getSubscriptionStatus(
  sub: typeof subscription.$inferSelect | null | undefined
): SubscriptionStatusInfo {
  if (!sub) {
    return {
      status: "none",
      isActive: false,
      display: "No subscription",
      needsAction: false,
    };
  }

  const statusMap: Record<SubscriptionStatus, Omit<SubscriptionStatusInfo, 'status'>> = {
    active: {
      isActive: true,
      display: "Active",
      needsAction: false,
    },
    trialing: {
      isActive: true,
      display: "Free Trial",
      needsAction: false,
    },
    past_due: {
      isActive: true,
      display: "Past Due - Action Required",
      needsAction: true,
    },
    canceled: {
      isActive: false,
      display: "Canceled",
      needsAction: false,
    },
    incomplete: {
      isActive: false,
      display: "Incomplete",
      needsAction: false,
    },
    incomplete_expired: {
      isActive: false,
      display: "Expired",
      needsAction: false,
    },
    paused: {
      isActive: false,
      display: "Paused",
      needsAction: false,
    },
    none: {
      isActive: false,
      display: "No subscription",
      needsAction: false,
    },
  };

  const statusStr = (sub.status as SubscriptionStatus) || "none";
  const info = statusMap[statusStr] || statusMap.none;

  return {
    status: statusStr,
    ...info,
  };
}

/**
 * Check if subscription needs immediate action
 */
