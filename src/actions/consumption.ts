"use server";

import { deductCredits } from "@/actions/credits";
import { getSessionWithOrg } from "@/lib/auth-helpers";
import { CREDIT_TYPES } from "@/lib/credits";

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

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to consume credits",
    };
  }
}
