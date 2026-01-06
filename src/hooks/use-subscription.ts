"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useActiveOrganization } from "@/lib/auth-client";
import { getUserSubscription } from "@/actions/stripe";
import { getSubscriptionStatus as getStatusInfo } from "@/lib/subscription";

interface SubscriptionState {
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

export const subscriptionKeys = {
    all: ["subscription"] as const,
    organization: (orgId: string) => [...subscriptionKeys.all, "org", orgId] as const,
};

/**
 * Client-side hook for subscription state
 * Single source of truth for subscription status in React components
 * 
 * Handles race conditions with:
 * - Wait for org to load before querying
 * - keepPreviousData to prevent flash
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
        placeholderData: keepPreviousData,  // Prevent flash on org change
        staleTime: 30 * 1000,
        refetchOnWindowFocus: true,
    });

    const subscription = data?.subscription ?? null;
    const statusInfo = subscription ? getStatusInfo(subscription) : null;

    return {
        subscription,
        isActive: statusInfo?.isActive ?? false,
        isTrialing: subscription?.status === "trialing",
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
