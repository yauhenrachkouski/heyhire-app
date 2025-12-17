"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveOrganization } from "@/lib/auth-client";
import { getUserSubscription, getSubscriptionStatus } from "@/actions/stripe";
import { isSubscriptionActive, getSubscriptionStatus as getStatusInfo } from "@/lib/subscription";

// =============================================================================
// TYPES
// =============================================================================

export interface SubscriptionState {
    subscription: Awaited<ReturnType<typeof getUserSubscription>>["subscription"];
    isActive: boolean;
    isTrialing: boolean;
    willCancel: boolean;
    plan: string | null;
    periodEnd: Date | null;
    trialEnd: Date | null;
    status: string | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

// =============================================================================
// QUERY KEYS
// =============================================================================

export const subscriptionKeys = {
    all: ["subscription"] as const,
    organization: (orgId: string) => [...subscriptionKeys.all, "org", orgId] as const,
};

// =============================================================================
// HOOK
// =============================================================================

/**
 * Client-side hook for subscription state
 * Single source of truth for subscription status in React components
 */
export function useSubscription(): SubscriptionState {
    const { data: activeOrg } = useActiveOrganization();
    const orgId = activeOrg?.id;

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: orgId ? subscriptionKeys.organization(orgId) : subscriptionKeys.all,
        queryFn: async () => {
            const result = await getUserSubscription();
            return result;
        },
        enabled: !!orgId,
        staleTime: 30 * 1000, // 30 seconds
        refetchOnWindowFocus: true,
    });

    const subscription = data?.subscription ?? null;
    const statusInfo = getStatusInfo(subscription);

    return {
        subscription,
        isActive: statusInfo.isActive,
        isTrialing: subscription?.status === "trialing" || subscription?.plan === "trial",
        willCancel: subscription?.cancelAtPeriodEnd ?? false,
        plan: subscription?.plan ?? null,
        periodEnd: subscription?.periodEnd ?? null,
        trialEnd: subscription?.trialEnd ?? null,
        status: subscription?.status ?? null,
        isLoading,
        error: error?.message ?? data?.error ?? null,
        refetch,
    };
}

/**
 * Simple check hook - just returns if subscription is active
 */
export function useHasActiveSubscription(): boolean {
    const { isActive, isLoading } = useSubscription();
    return !isLoading && isActive;
}

/**
 * Hook to get subscription display info
 */
export function useSubscriptionDisplay() {
    const { subscription, isLoading } = useSubscription();
    const statusInfo = getStatusInfo(subscription);

    return {
        display: statusInfo.display,
        needsAction: statusInfo.needsAction,
        isLoading,
    };
}
