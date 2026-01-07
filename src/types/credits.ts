import type { creditTransactions } from "@/db/schema";

// Enum types matching database enums
type TransactionType = "subscription_grant" | "manual_grant" | "purchase" | "consumption";
export type CreditType = "general" | "linkedin_reveal" | "email_reveal" | "phone_reveal";

// Infer types from schema
export type CreditTransaction = typeof creditTransactions.$inferSelect;

// Credit statistics
export interface CreditStats {
  totalUsed: number;
  totalAdded: number;
  byType: {
    [key in CreditType]: {
      used: number;
      added: number;
    };
  };
  recentTransactions: CreditTransaction[];
}

// Filter options for credit history
export interface CreditHistoryFilters {
  creditType?: CreditType;
  transactionType?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  limit?: number;
  offset?: number;
}

// Response types for credit actions
export interface AddCreditsParams {
  organizationId: string;
  userId: string;
  amount: number;
  type: TransactionType;
  creditType: CreditType;
  relatedEntityId?: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface DeductCreditsParams {
  organizationId: string;
  userId: string;
  amount: number;
  creditType: CreditType;
  relatedEntityId: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface CreditOperationResult {
  success: boolean;
  transaction?: CreditTransaction;
  error?: string;
}






