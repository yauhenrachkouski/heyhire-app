"use server";

import { deductCredits } from "@/actions/credits";
import { getSessionWithOrg } from "@/lib/auth-helpers";
import { CREDIT_TYPES } from "@/lib/credits";
import { trackServerEvent } from "@/lib/posthog/track";
import { db } from "@/db/drizzle";
import { creditTransactions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const LINKEDIN_OPEN_DESCRIPTION = "Open LinkedIn profile";

export async function consumeCreditsForLinkedInOpen(params: {
  candidateId: string;
  linkedinUrl: string;
}): Promise<{ success: boolean; error?: string; alreadyCharged?: boolean }> {
  const { candidateId, linkedinUrl } = params;

  try {
    const { activeOrgId, userId } = await getSessionWithOrg();

    // Use a transaction to prevent race conditions
    return await db.transaction(async (tx) => {
      // Check if credits were already consumed for this candidate by this organization
      const existingTransaction = await tx.query.creditTransactions.findFirst({
        where: and(
          eq(creditTransactions.organizationId, activeOrgId),
          eq(creditTransactions.relatedEntityId, candidateId),
          eq(creditTransactions.creditType, CREDIT_TYPES.GENERAL),
          eq(creditTransactions.type, "consumption"),
          eq(creditTransactions.description, LINKEDIN_OPEN_DESCRIPTION)
        ),
      });

      // If already charged, return success without charging again
      if (existingTransaction) {
        return { success: true, alreadyCharged: true };
      }

      const result = await deductCredits({
        organizationId: activeOrgId,
        userId,
        amount: 1,
        creditType: CREDIT_TYPES.GENERAL,
        relatedEntityId: candidateId,
        description: LINKEDIN_OPEN_DESCRIPTION,
        metadata: { linkedinUrl },
      });

      if (!result.success) {
        return { success: false, error: result.error || "Failed to consume credits" };
      }

      trackServerEvent(userId, "credits_consumed", activeOrgId, {
        action: "linkedin_profile_opened",
        candidate_id: candidateId,
        linkedin_url: linkedinUrl,
        credit_type: CREDIT_TYPES.GENERAL,
        credit_amount: 1,
        credit_transaction_id: result.transaction?.id,
        credits_before: result.transaction?.balanceBefore,
        credits_after: result.transaction?.balanceAfter,
      });

      return { success: true };
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to consume credits",
    };
  }
}
