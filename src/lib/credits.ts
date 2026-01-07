import type { CreditType } from "@/types/credits";
import { PLAN_LIMITS } from "@/types/plans";

/**
 * Credit type constants
 */
export const CREDIT_TYPES: Record<string, CreditType> = {
  GENERAL: "general",
  LINKEDIN_REVEAL: "linkedin_reveal",
  EMAIL_REVEAL: "email_reveal",
  PHONE_REVEAL: "phone_reveal",
} as const;

/**
 * Default credit allocations per subscription plan
 */
const PLAN_CREDIT_ALLOCATIONS: Record<string, number> = {
  pro: PLAN_LIMITS.pro.credits,
};

/**
 * Default trial credit allocations per subscription plan
 */
const TRIAL_CREDIT_ALLOCATIONS: Record<string, number> = {
  pro: PLAN_LIMITS.pro.trialCredits,
};

/**
 * Get credit allocation for a plan
 * @param plan - Plan name
 * @returns Number of credits
 */
export function getPlanCreditAllocation(plan: string): number {
  return PLAN_CREDIT_ALLOCATIONS[plan.toLowerCase()] ?? 0;
}

export function getTrialCreditAllocation(plan: string): number {
  return TRIAL_CREDIT_ALLOCATIONS[plan.toLowerCase()] ?? 0;
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
  usage: (organizationId: string, start: Date | string | null, end: Date | string | null) =>
    [...creditsKeys.organization(organizationId), "usage", { start, end }] as const,
};






