"use server";

import { log } from "@/lib/axiom/server";

const source = "actions/credits";

import { db } from "@/db/drizzle";
import { organization, creditTransactions, user } from "@/db/schema";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { generateId } from "@/lib/id";
import { getSessionWithOrg } from "@/lib/auth-helpers";
import { getPostHogServer } from "@/lib/posthog/posthog-server";
import type {
  DeductCreditsParams,
  CreditOperationResult,
  CreditType,
} from "@/types/credits";

/**
 * Get current credit balance for an organization
 * @param organizationId - Organization ID
 * @returns Current credit balance
 */
export async function getOrganizationCredits(organizationId: string): Promise<number> {
  const org = await db.query.organization.findFirst({
    where: eq(organization.id, organizationId),
    columns: {
      credits: true,
    },
  });
  
  return org?.credits ?? 0;
}

export async function getCreditsUsageForPeriod(params: {
  organizationId: string;
  startDate: Date;
  endDate: Date;
  creditType?: CreditType;
}): Promise<{ used: number; error: string | null }> {
  const { userId, activeOrgId } = await getSessionWithOrg();
  try {
    const { organizationId, startDate, endDate, creditType } = params;

    // Verify access
    if (activeOrgId !== organizationId) {
      return { used: 0, error: "Unauthorized" };
    }

    const whereConditions = [
      eq(creditTransactions.organizationId, organizationId),
      gte(creditTransactions.createdAt, startDate),
      lte(creditTransactions.createdAt, endDate),
      eq(creditTransactions.type, "consumption"),
    ];

    if (creditType) {
      whereConditions.push(eq(creditTransactions.creditType, creditType));
    }

    const result = await db
      .select({ used: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)` })
      .from(creditTransactions)
      .where(and(...whereConditions));

    return { used: Number(result[0]?.used ?? 0), error: null };
  } catch (error) {
    log.error("period_usage.error", { source, userId, organizationId: activeOrgId, error: error instanceof Error ? error.message : String(error) });
    return {
      used: 0,
      error: error instanceof Error ? error.message : "Failed to calculate usage",
    };
  }
}

/**
 * Deduct credits from an organization with full audit trail
 * Throws error if insufficient credits
 * @param params - Deduct credits parameters
 * @returns Operation result with transaction details
 */
export async function deductCredits(
  params: DeductCreditsParams
): Promise<CreditOperationResult> {
  const {
    organizationId,
    userId,
    amount,
    creditType,
    relatedEntityId,
    description,
    metadata,
  } = params;
  
  if (amount <= 0) {
    return {
      success: false,
      error: "Amount must be positive",
    };
  }
  
  try {
    // Use a transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // Get current balance
      const org = await tx.query.organization.findFirst({
        where: eq(organization.id, organizationId),
        columns: { credits: true },
      });
      
      if (!org) {
        throw new Error("Organization not found");
      }
      
      const balanceBefore = org.credits;
      
      // Check if sufficient balance
      if (balanceBefore < amount) {
        throw new Error("Insufficient credits. Please upgrade your plan");
      }
      
      const balanceAfter = balanceBefore - amount;
      
      // Update organization credits
      await tx
        .update(organization)
        .set({ credits: balanceAfter })
        .where(eq(organization.id, organizationId));
      
      // Create transaction record (negative amount for deduction)
      const transactionId = generateId();
      const metadataJson = metadata ? JSON.stringify(metadata) : null;
      
      await tx.insert(creditTransactions).values({
        id: transactionId,
        organizationId,
        userId,
        type: "consumption",
        creditType,
        amount: -amount, // Negative for consumption
        balanceBefore,
        balanceAfter,
        relatedEntityId,
        description,
        metadata: metadataJson,
      });
      
      // Fetch and return the created transaction
      const transaction = await tx.query.creditTransactions.findFirst({
        where: eq(creditTransactions.id, transactionId),
      });
      
      return transaction;
    });
    
    // Track credits_exhausted when balance reaches zero
    if (result && result.balanceAfter === 0) {
      getPostHogServer().capture({
        distinctId: userId,
        event: "credits_exhausted",
        groups: { organization: organizationId },
        properties: {
          organization_id: organizationId,
          credit_type: creditType,
          credits_before: result.balanceBefore,
          credit_transaction_id: result.id,
        },
      });
    }

    // Track credits_low when balance drops below threshold
    if (result) {
      const thresholdRaw = process.env.CREDITS_LOW_THRESHOLD;
      const threshold = thresholdRaw ? Number(thresholdRaw) : NaN;

      if (
        Number.isFinite(threshold) &&
        threshold >= 0 &&
        result.balanceBefore > threshold &&
        result.balanceAfter <= threshold &&
        result.balanceAfter > 0
      ) {
        getPostHogServer().capture({
          distinctId: userId,
          event: "credits_low",
          groups: { organization: organizationId },
          properties: {
            organization_id: organizationId,
            credit_type: creditType,
            credits_remaining: result.balanceAfter,
            threshold,
            credit_transaction_id: result.id,
          },
        });
      }
    }

    return {
      success: true,
      transaction: result,
    };
  } catch (error) {
    log.error("deduct_credits.error", { source, organizationId, userId, error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to deduct credits",
    };
  }
}

export type CreditTransaction = {
  id: string;
  type: "subscription_grant" | "manual_grant" | "purchase" | "consumption";
  creditType: "general" | "linkedin_reveal" | "email_reveal" | "phone_reveal";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: Date;
  userName: string | null;
};

/**
 * Get credit transactions for an organization with pagination
 */
export async function getCreditTransactions(params: {
  limit?: number;
  offset?: number;
}): Promise<{ transactions: CreditTransaction[]; total: number; error: string | null }> {
  const { limit = 20, offset = 0 } = params;

  try {
    const { activeOrgId } = await getSessionWithOrg();

    if (!activeOrgId) {
      return { transactions: [], total: 0, error: "No active organization" };
    }

    // Get transactions with user info
    const transactions = await db
      .select({
        id: creditTransactions.id,
        type: creditTransactions.type,
        creditType: creditTransactions.creditType,
        amount: creditTransactions.amount,
        balanceBefore: creditTransactions.balanceBefore,
        balanceAfter: creditTransactions.balanceAfter,
        description: creditTransactions.description,
        createdAt: creditTransactions.createdAt,
        userName: user.name,
      })
      .from(creditTransactions)
      .leftJoin(user, eq(creditTransactions.userId, user.id))
      .where(eq(creditTransactions.organizationId, activeOrgId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(eq(creditTransactions.organizationId, activeOrgId));

    const total = Number(countResult[0]?.count ?? 0);

    return { transactions, total, error: null };
  } catch (error) {
    log.error("get_credit_transactions.error", {
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      transactions: [],
      total: 0,
      error: error instanceof Error ? error.message : "Failed to fetch transactions",
    };
  }
}
