"use server";

import { db } from "@/db/drizzle";
import { organization, creditTransactions } from "@/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { generateId } from "@/lib/id";
import type {
  AddCreditsParams,
  DeductCreditsParams,
  CreditOperationResult,
  CreditHistoryFilters,
  CreditStats,
  CreditType,
  CreditTransaction,
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

/**
 * Get credit balance (total or by type)
 * Note: Currently we track total credits. Type-specific tracking can be added
 * by summing transactions by credit_type if needed.
 * @param organizationId - Organization ID
 * @param creditType - Optional: Get balance for specific credit type
 * @returns Credit balance
 */
export async function getCreditBalance(
  organizationId: string,
  creditType?: CreditType
): Promise<number> {
  if (!creditType) {
    // Return total balance
    return getOrganizationCredits(organizationId);
  }
  
  // For type-specific balance, sum all transactions of that type
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)` })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.organizationId, organizationId),
        eq(creditTransactions.creditType, creditType)
      )
    );
  
  return Number(result[0]?.total ?? 0);
}

/**
 * Check if organization can afford the credit cost
 * @param organizationId - Organization ID
 * @param amount - Amount of credits needed
 * @param creditType - Optional: Check for specific credit type
 * @returns True if organization has enough credits
 */
export async function canAfford(
  organizationId: string,
  amount: number,
  creditType?: CreditType
): Promise<boolean> {
  const balance = await getCreditBalance(organizationId, creditType);
  return balance >= amount;
}

/**
 * Add credits to an organization with full audit trail
 * @param params - Add credits parameters
 * @returns Operation result with transaction details
 */
export async function addCredits(
  params: AddCreditsParams
): Promise<CreditOperationResult> {
  const {
    organizationId,
    userId,
    amount,
    type,
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
      const balanceAfter = balanceBefore + amount;
      
      // Update organization credits
      await tx
        .update(organization)
        .set({ credits: balanceAfter })
        .where(eq(organization.id, organizationId));
      
      // Create transaction record
      const transactionId = generateId();
      const metadataJson = metadata ? JSON.stringify(metadata) : null;
      
      await tx.insert(creditTransactions).values({
        id: transactionId,
        organizationId,
        userId,
        type,
        creditType,
        amount,
        balanceBefore,
        balanceAfter,
        relatedEntityId: relatedEntityId ?? null,
        description,
        metadata: metadataJson,
      });
      
      // Fetch and return the created transaction
      const transaction = await tx.query.creditTransactions.findFirst({
        where: eq(creditTransactions.id, transactionId),
      });
      
      return transaction;
    });
    
    return {
      success: true,
      transaction: result,
    };
  } catch (error) {
    console.error("[Credits] Error adding credits:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to add credits",
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
        throw new Error(
          `Insufficient credits. Required: ${amount}, Available: ${balanceBefore}`
        );
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
    
    return {
      success: true,
      transaction: result,
    };
  } catch (error) {
    console.error("[Credits] Error deducting credits:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to deduct credits",
    };
  }
}

/**
 * Get credit transaction history with optional filters
 * @param organizationId - Organization ID
 * @param filters - Optional filters for the query
 * @returns Array of credit transactions
 */
export async function getCreditHistory(
  organizationId: string,
  filters?: CreditHistoryFilters
): Promise<CreditTransaction[]> {
  const conditions = [eq(creditTransactions.organizationId, organizationId)];
  
  // Apply filters
  if (filters?.creditType) {
    conditions.push(eq(creditTransactions.creditType, filters.creditType));
  }
  
  if (filters?.transactionType) {
    conditions.push(eq(creditTransactions.type, filters.transactionType));
  }
  
  if (filters?.userId) {
    conditions.push(eq(creditTransactions.userId, filters.userId));
  }
  
  if (filters?.startDate) {
    conditions.push(gte(creditTransactions.createdAt, filters.startDate));
  }
  
  if (filters?.endDate) {
    conditions.push(lte(creditTransactions.createdAt, filters.endDate));
  }
  
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  
  const transactions = await db.query.creditTransactions.findMany({
    where: and(...conditions),
    orderBy: [desc(creditTransactions.createdAt)],
    limit,
    offset,
  });
  
  return transactions;
}

/**
 * Get credit usage statistics for an organization
 * @param organizationId - Organization ID
 * @returns Credit statistics
 */
export async function getCreditStats(organizationId: string): Promise<CreditStats> {
  // Get all transactions
  const transactions = await db.query.creditTransactions.findMany({
    where: eq(creditTransactions.organizationId, organizationId),
    orderBy: [desc(creditTransactions.createdAt)],
  });
  
  // Calculate totals
  const totalUsed = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  
  const totalAdded = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  // Calculate by type
  const byType = {
    contact_lookup: { used: 0, added: 0 },
    export: { used: 0, added: 0 },
    general: { used: 0, added: 0 },
  };
  
  for (const transaction of transactions) {
    const type = transaction.creditType as CreditType;
    if (transaction.amount < 0) {
      byType[type].used += Math.abs(transaction.amount);
    } else {
      byType[type].added += transaction.amount;
    }
  }
  
  // Get recent transactions (last 10)
  const recentTransactions = transactions.slice(0, 10);
  
  return {
    totalUsed,
    totalAdded,
    byType,
    recentTransactions,
  };
}








