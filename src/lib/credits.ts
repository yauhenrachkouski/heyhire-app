import type { CreditType, TransactionType } from "@/types/credits";

/**
 * Format credit amount for display
 * @param amount - Credit amount (can be negative for deductions)
 * @returns Formatted string with appropriate sign
 */
export function formatCreditAmount(amount: number): string {
  const sign = amount >= 0 ? "+" : "";
  return `${sign}${amount.toLocaleString()}`;
}

/**
 * Get human-readable label for credit type
 * @param creditType - The credit type enum value
 * @returns Human-readable label
 */
export function getCreditTypeLabel(creditType: CreditType): string {
  const labels: Record<CreditType, string> = {
    contact_lookup: "Contact Lookup",
    export: "Export",
    general: "General",
  };
  
  return labels[creditType];
}

/**
 * Get human-readable label for transaction type
 * @param type - The transaction type enum value
 * @returns Human-readable label
 */
export function getTransactionTypeLabel(type: TransactionType): string {
  const labels: Record<TransactionType, string> = {
    subscription_grant: "Subscription Grant",
    manual_grant: "Manual Grant",
    purchase: "Purchase",
    consumption: "Used",
  };
  
  return labels[type];
}

/**
 * Calculate cost for different actions
 * Currently only contact lookup has a defined cost (1 credit)
 * @param action - The action type
 * @param params - Optional parameters for the action
 * @returns Number of credits required
 */
export function calculateCreditCost(
  action: "contact_lookup" | "export",
  params?: { count?: number }
): number {
  const costs = {
    contact_lookup: 1,
    export: 1, // Can be made configurable per export type
  };
  
  const baseCost = costs[action] || 1;
  const count = params?.count || 1;
  
  return baseCost * count;
}

/**
 * Credit type constants
 */
export const CREDIT_TYPES: Record<string, CreditType> = {
  CONTACT_LOOKUP: "contact_lookup",
  EXPORT: "export",
  GENERAL: "general",
} as const;

/**
 * Transaction type constants
 */
export const TRANSACTION_TYPES: Record<string, TransactionType> = {
  SUBSCRIPTION_GRANT: "subscription_grant",
  MANUAL_GRANT: "manual_grant",
  PURCHASE: "purchase",
  CONSUMPTION: "consumption",
} as const;

/**
 * Default credit allocations per subscription plan
 */
export const PLAN_CREDIT_ALLOCATIONS: Record<string, { contact_lookup: number; export: number }> = {
  starter: {
    contact_lookup: 100,
    export: 50,
  },
  pro: {
    contact_lookup: 500,
    export: 200,
  },
  enterprise: {
    contact_lookup: -1, // -1 means unlimited
    export: -1,
  },
};

/**
 * Check if a plan has unlimited credits for a type
 * @param plan - Plan name
 * @param creditType - Credit type to check
 * @returns True if unlimited
 */
export function hasUnlimitedCredits(plan: string, creditType: CreditType): boolean {
  const allocation = PLAN_CREDIT_ALLOCATIONS[plan.toLowerCase()];
  if (!allocation) return false;
  
  if (creditType === "contact_lookup") {
    return allocation.contact_lookup === -1;
  }
  
  if (creditType === "export") {
    return allocation.export === -1;
  }
  
  return false;
}

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
  
  if (creditType === "export") {
    return allocation.export;
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

/**
 * Check if organization is low on credits (below threshold)
 * @param balance - Current balance
 * @param threshold - Warning threshold (default 10)
 * @returns True if low on credits
 */
export function isLowOnCredits(balance: number, threshold: number = 10): boolean {
  if (balance === -1) return false; // Unlimited
  return balance < threshold;
}

export const creditsKeys = {
  all: ["credits"] as const,
  organization: (organizationId: string) =>
    [...creditsKeys.all, "organization", organizationId] as const,
};








