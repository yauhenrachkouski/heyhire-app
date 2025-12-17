"use server";

import { deductCredits } from "@/actions/credits";
import { getSessionWithOrg } from "@/lib/auth-helpers";
import { CREDIT_TYPES } from "@/lib/credits";
import { trackServerEvent } from "@/lib/posthog/track";

export async function consumeCreditsForLinkedInOpen(params: {
  candidateId: string;
  linkedinUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const { candidateId, linkedinUrl } = params;

  try {
    const { activeOrgId, userId } = await getSessionWithOrg();

    const result = await deductCredits({
      organizationId: activeOrgId,
      userId,
      amount: 1,
      creditType: CREDIT_TYPES.GENERAL,
      relatedEntityId: candidateId,
      description: "Open LinkedIn profile",
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
    })

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to consume credits",
    };
  }
}
