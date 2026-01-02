"use server";

import { db } from "@/db/drizzle";
import { organization, creditTransactions, member, user } from "@/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { generateId } from "@/lib/id";
import { Resend } from "resend";
import { CreditsRunningLowEmail } from "@/emails";
import { getSessionWithOrg } from "@/lib/auth-helpers";
import type {
  AddCreditsParams,
  DeductCreditsParams,
  CreditOperationResult,
  CreditHistoryFilters,
  CreditStats,
  CreditType,
  CreditTransaction,
} from "@/types/credits";

const resend = new Resend(process.env.RESEND_API_KEY);

async function getOrgOwnerEmail(organizationId: string): Promise<string | null> {
  const owner = await db.query.member.findFirst({
    where: and(eq(member.organizationId, organizationId), eq(member.role, "owner")),
    columns: { userId: true },
  });

  const ownerId = owner?.userId;
  if (!ownerId) return null;

  const ownerUser = await db.query.user.findFirst({
    where: eq(user.id, ownerId),
    columns: { email: true },
  });

  return ownerUser?.email || null;
}

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
  try {
    const { organizationId, startDate, endDate, creditType } = params;

    // Verify access
    const { activeOrgId } = await getSessionWithOrg();
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
    console.error("[Credits] Error calculating period usage:", error);
    return {
      used: 0,
      error: error instanceof Error ? error.message : "Failed to calculate usage",
    };
  }
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

    // Best-effort low credits email alert
    try {
      const thresholdRaw = process.env.CREDITS_LOW_THRESHOLD;
      const threshold = thresholdRaw ? Number(thresholdRaw) : NaN;

      if (Number.isFinite(threshold) && threshold >= 0) {
        const before = result?.balanceBefore;
        const after = result?.balanceAfter;

        if (
          typeof before === "number" &&
          typeof after === "number" &&
          before > threshold &&
          after <= threshold
        ) {
          const to = await getOrgOwnerEmail(params.organizationId);
          if (to) {
            const orgRecord = await db.query.organization.findFirst({
              where: eq(organization.id, params.organizationId),
              columns: { name: true },
            });

            const emailContent = CreditsRunningLowEmail({
              organizationName: orgRecord?.name || params.organizationId,
              creditsRemaining: after,
              threshold,
              ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`,
            });

            await resend.emails.send({
              from: process.env.EMAIL_FROM as string,
              to,
              subject: `Credits running low (${after} remaining)`,
              react: emailContent,
            });
          }
        }
      }
    } catch (e) {
      console.warn("[Credits] Failed to send low credits email", e);
    }
    
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

export async function setCreditsBalance(params: {
  organizationId: string;
  userId: string;
  newBalance: number;
  type: CreditTransaction["type"];
  creditType: CreditType;
  relatedEntityId?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<CreditOperationResult> {
  const {
    organizationId,
    userId,
    newBalance,
    type,
    creditType,
    relatedEntityId,
    description,
    metadata,
  } = params;

  if (newBalance < 0) {
    return {
      success: false,
      error: "Balance cannot be negative",
    };
  }

  try {
    const result = await db.transaction(async (tx) => {
      const org = await tx.query.organization.findFirst({
        where: eq(organization.id, organizationId),
        columns: { credits: true },
      });

      if (!org) {
        throw new Error("Organization not found");
      }

      const balanceBefore = org.credits;
      const balanceAfter = newBalance;
      const amount = balanceAfter - balanceBefore;

      if (amount === 0) {
        return undefined;
      }

      await tx
        .update(organization)
        .set({ credits: balanceAfter })
        .where(eq(organization.id, organizationId));

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

      const transaction = await tx.query.creditTransactions.findFirst({
        where: eq(creditTransactions.id, transactionId),
      });

      return transaction;
    });

    return {
      success: true,
      transaction: result ?? undefined,
    };
  } catch (error) {
    console.error("[Credits] Error setting credit balance:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set credit balance",
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

export async function getCreditLedger(params: {
  organizationId: string;
  limit?: number;
}): Promise<{ balance: number; transactions: CreditTransaction[] }> {
  const { organizationId, limit = 50 } = params;

  const balance = await getOrganizationCredits(organizationId);
  const transactions = await db.query.creditTransactions.findMany({
    where: eq(creditTransactions.organizationId, organizationId),
    orderBy: [desc(creditTransactions.createdAt)],
    limit,
  });

  return { balance, transactions };
}








