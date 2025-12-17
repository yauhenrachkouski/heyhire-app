"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveOrganization } from "@/lib/auth-client";
import { getOrganizationCredits, getCreditLedger } from "@/actions/credits";
import { isLowOnCredits } from "@/lib/credits";
import { creditsKeys } from "@/lib/credits";

// =============================================================================
// TYPES
// =============================================================================

export interface CreditsState {
    balance: number;
    isLow: boolean;
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
    invalidate: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Client-side hook for credits balance
 * Single source of truth for credits state in React components
 */
export function useCredits(): CreditsState {
    const { data: activeOrg } = useActiveOrganization();
    const queryClient = useQueryClient();
    const orgId = activeOrg?.id;

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: orgId ? creditsKeys.organization(orgId) : creditsKeys.all,
        queryFn: async () => {
            if (!orgId) return 0;
            return getOrganizationCredits(orgId);
        },
        enabled: !!orgId,
        staleTime: 10 * 1000, // 10 seconds - credits change more frequently
        refetchOnWindowFocus: true,
    });

    const balance = data ?? 0;

    const invalidate = () => {
        if (orgId) {
            queryClient.invalidateQueries({ queryKey: creditsKeys.organization(orgId) });
        } else {
            queryClient.invalidateQueries({ queryKey: creditsKeys.all });
        }
    };

    return {
        balance,
        isLow: isLowOnCredits(balance),
        isLoading,
        error: error?.message ?? null,
        refetch,
        invalidate,
    };
}

/**
 * Hook for credits with transaction history
 */
export function useCreditsWithHistory(limit: number = 10) {
    const { data: activeOrg } = useActiveOrganization();
    const orgId = activeOrg?.id;

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: orgId ? [...creditsKeys.organization(orgId), "history", limit] : [...creditsKeys.all, "history"],
        queryFn: async () => {
            if (!orgId) return { balance: 0, transactions: [] };
            return getCreditLedger({ organizationId: orgId, limit });
        },
        enabled: !!orgId,
        staleTime: 30 * 1000,
    });

    return {
        balance: data?.balance ?? 0,
        transactions: data?.transactions ?? [],
        isLoading,
        error: error?.message ?? null,
        refetch,
    };
}

/**
 * Simple hook - just returns if can afford amount
 */
export function useCanAfford(amount: number): boolean {
    const { balance, isLoading } = useCredits();
    return !isLoading && balance >= amount;
}
