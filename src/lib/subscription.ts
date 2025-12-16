import { subscription } from "@/db/schema";

export type SubscriptionStatus = 
  | "active" 
  | "trialing" 
  | "past_due" 
  | "canceled" 
  | "incomplete" 
  | "incomplete_expired" 
  | "paused"
  | "none";

export interface SubscriptionStatusInfo {
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

  if (sub.plan === "trial" && sub.periodEnd) {
    return new Date(sub.periodEnd).getTime() > Date.now();
  }

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
export function isSubscriptionAtRisk(
  sub: typeof subscription.$inferSelect | null | undefined
): boolean {
  if (!sub) return false;
  return sub.status === "past_due" || sub.cancelAtPeriodEnd === true;
}

/**
 * Get days until subscription ends/renews
 */
export function getDaysUntilRenewal(
  sub: typeof subscription.$inferSelect | null | undefined
): number | null {
  if (!sub?.periodEnd) return null;

  const endDate = new Date(sub.periodEnd);
  const now = new Date();
  const daysLeft = Math.ceil(
    (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  return Math.max(0, daysLeft);
}

/**
 * Get percentage of trial days used
 */
export function getTrialProgress(
  sub: typeof subscription.$inferSelect | null | undefined
): number {
  if (!sub?.trialStart || !sub?.trialEnd) return 0;

  const start = new Date(sub.trialStart);
  const end = new Date(sub.trialEnd);
  const now = new Date();

  const totalDuration = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));

  return Math.round(progress);
}

/**
 * Format subscription info for display
 */
export function formatSubscriptionInfo(
  sub: typeof subscription.$inferSelect | null | undefined
): string {
  const statusInfo = getSubscriptionStatus(sub);

  if (!sub) return statusInfo.display;

  const parts = [statusInfo.display];
  
  if (sub.plan) {
    parts.push(`(${sub.plan})`);
  }

  if (sub.trialEnd && statusInfo.status === "trialing") {
    const daysLeft = getDaysUntilRenewal(sub);
    if (daysLeft !== null) {
      parts.push(`${daysLeft} days left`);
    }
  } else if (sub.periodEnd && statusInfo.isActive) {
    const daysLeft = getDaysUntilRenewal(sub);
    if (daysLeft !== null) {
      parts.push(`renews in ${daysLeft} days`);
    }
  }

  if (sub.cancelAtPeriodEnd) {
    parts.push("(cancels at period end)");
  }

  return parts.join(" ");
}
