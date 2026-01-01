import type { CreditType } from "@/types/credits";
import { PLAN_LIMITS } from "@/types/plans";

/**
 * Credit type constants
 */
export const CREDIT_TYPES: Record<string, CreditType> = {
  CONTACT_LOOKUP: "contact_lookup",
  EXPORT: "export",
  GENERAL: "general",
} as const;

/**
 * Default credit allocations per subscription plan
 */
const PLAN_CREDIT_ALLOCATIONS: Record<string, { contact_lookup: number }> = {
  pro: {
    contact_lookup: PLAN_LIMITS.pro.credits,
  },
};

/**
 * Default trial credit allocations per subscription plan
 */
const TRIAL_CREDIT_ALLOCATIONS: Record<string, { contact_lookup: number }> = {
  pro: {
    contact_lookup: PLAN_LIMITS.pro.trialCredits,
  },
};

/**
 * Get credit allocation for a plan
 * @param plan - Plan name
 * @param creditType - Credit type to get allocation for
 * @returns Number of credits (or -1 for unlimited)
 */
export function getPlanCreditAllocation(plan: string, creditType: CreditType): number {
  const allocation = PLAN_CREDIT_ALLOCATIONS[plan.toLowerCase()];
  if (!allocation) return 0;
  
  if (creditType === "contact_lookup") {
    return allocation.contact_lookup;
  }
  
  return 0;
}

export function getTrialCreditAllocation(plan: string, creditType: CreditType): number {
  const allocation = TRIAL_CREDIT_ALLOCATIONS[plan.toLowerCase()];
  if (!allocation) return 0;

  if (creditType === "contact_lookup") {
    return allocation.contact_lookup;
  }

  return 0;
}

/**
 * Format credit balance for display
 * Shows infinity symbol for unlimited credits
 * @param balance - Credit balance (-1 for unlimited)
 * @returns Formatted string
 */
export function formatCreditBalance(balance: number): string {
  if (balance === -1) {
    return "∞";
  }
  return balance.toLocaleString();
}

export const creditsKeys = {
  all: ["credits"] as const,
  organization: (organizationId: string) =>
    [...creditsKeys.all, "organization", organizationId] as const,
};






