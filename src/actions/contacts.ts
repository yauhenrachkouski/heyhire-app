"use server";

import { deductCredits, getOrganizationCredits } from "@/actions/credits";
import { getSessionWithOrg } from "@/lib/auth-helpers";
import { CREDIT_TYPES } from "@/lib/credits";
import { CONTACT_REVEAL_DESCRIPTION } from "@/lib/consumption";
import { getPostHogServer } from "@/lib/posthog/posthog-server";
import { db } from "@/db/drizzle";
import { candidateContacts, candidates } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/id";
import {
  findEmailByLinkedIn,
  findPhoneByLinkedIn,
  FindymailError,
} from "@/lib/findymail";
import { log } from "@/lib/axiom/server";

const source = "actions/contacts";

// Credit costs
const EMAIL_CREDIT_COST = 1;
const PHONE_CREDIT_COST = 10;

export type RevealContactType = "email" | "phone" | "both";

export type RevealContactResult = {
  success: boolean;
  error?: string;
  alreadyRevealed?: boolean;
  email?: string | null;
  phone?: string | null;
  creditTransactionId?: string;
};

/**
 * Reveal contact information (email/phone) for a candidate using Findymail API
 * - Checks if already revealed for this organization (free re-access)
 * - Calls Findymail API to get contact info
 * - Deducts credits: 1 for email, 10 for phone
 * - Stores result in candidateContacts table
 */
export async function revealCandidateContact(params: {
  candidateId: string;
  type: RevealContactType;
}): Promise<RevealContactResult> {
  const { candidateId, type } = params;

  try {
    const { activeOrgId, userId } = await getSessionWithOrg();

    // Get candidate to get LinkedIn URL
    const candidate = await db.query.candidates.findFirst({
      where: eq(candidates.id, candidateId),
      columns: {
        id: true,
        linkedinUrl: true,
        fullName: true,
      },
    });

    if (!candidate) {
      return { success: false, error: "Candidate not found" };
    }

    if (!candidate.linkedinUrl) {
      return { success: false, error: "Candidate has no LinkedIn URL" };
    }

    // Use a transaction to prevent race conditions
    return await db.transaction(async (tx) => {
      // Check if contact was already revealed for this organization
      const existingContact = await tx.query.candidateContacts.findFirst({
        where: and(
          eq(candidateContacts.candidateId, candidateId),
          eq(candidateContacts.organizationId, activeOrgId)
        ),
      });

      // If already revealed, return cached data
      if (existingContact) {
        // Check if we need additional data (e.g., had email, now want phone)
        const needEmail = (type === "email" || type === "both") && !existingContact.email;
        const needPhone = (type === "phone" || type === "both") && !existingContact.phone;

        if (!needEmail && !needPhone) {
          return {
            success: true,
            alreadyRevealed: true,
            email: existingContact.email,
            phone: existingContact.phone,
          };
        }

        // Calculate required credits upfront
        const requiredCredits =
          (needEmail ? EMAIL_CREDIT_COST : 0) +
          (needPhone ? PHONE_CREDIT_COST : 0);

        // Check credits BEFORE making API calls
        const currentCredits = await getOrganizationCredits(activeOrgId);
        if (currentCredits < requiredCredits) {
          return {
            success: false,
            error: `Insufficient credits. You need ${requiredCredits} credits but have ${currentCredits}.`
          };
        }

        // Need to fetch additional data
        let newEmail: string | null = existingContact.email;
        let newPhone: string | null = existingContact.phone;
        let rawResponse: Record<string, unknown> = {};
        let emailFound = false;
        let phoneFound = false;

        try {
          if (needEmail) {
            const emailResult = await findEmailByLinkedIn(candidate.linkedinUrl);
            if (emailResult.contact?.email) {
              newEmail = emailResult.contact.email;
              emailFound = true;
              rawResponse = { ...rawResponse, emailResult };
            }
          }

          if (needPhone) {
            const phoneResult = await findPhoneByLinkedIn(candidate.linkedinUrl);
            if (phoneResult.phone) {
              newPhone = phoneResult.phone;
              phoneFound = true;
              rawResponse = { ...rawResponse, phoneResult };
            }
          }
        } catch (err) {
          if (err instanceof FindymailError) {
            if (err.code === "NOT_ENOUGH_CREDITS") {
              return { success: false, error: "Not enough Findymail credits. Please contact support." };
            }
            return { success: false, error: err.message };
          }
          throw err;
        }

        // Deduct credits separately for email and phone
        let lastTransactionId: string | undefined;

        if (emailFound) {
          const creditResult = await deductCredits({
            organizationId: activeOrgId,
            userId,
            amount: EMAIL_CREDIT_COST,
            creditType: CREDIT_TYPES.EMAIL_REVEAL,
            relatedEntityId: candidateId,
            description: "Reveal email",
            metadata: { linkedinUrl: candidate.linkedinUrl },
          });
          if (!creditResult.success) {
            return { success: false, error: creditResult.error || "Failed to deduct credits" };
          }
          lastTransactionId = creditResult.transaction?.id;
        }

        if (phoneFound) {
          const creditResult = await deductCredits({
            organizationId: activeOrgId,
            userId,
            amount: PHONE_CREDIT_COST,
            creditType: CREDIT_TYPES.PHONE_REVEAL,
            relatedEntityId: candidateId,
            description: "Reveal phone",
            metadata: { linkedinUrl: candidate.linkedinUrl },
          });
          if (!creditResult.success) {
            return { success: false, error: creditResult.error || "Failed to deduct credits" };
          }
          lastTransactionId = creditResult.transaction?.id;
        }

        // Update existing contact with new data
        if (emailFound || phoneFound) {
          await tx
            .update(candidateContacts)
            .set({
              email: newEmail,
              phone: newPhone,
              rawResponse: JSON.stringify({
                ...JSON.parse(existingContact.rawResponse || "{}"),
                ...rawResponse,
              }),
              creditTransactionId: lastTransactionId,
            })
            .where(eq(candidateContacts.id, existingContact.id));

          getPostHogServer().capture({
            distinctId: userId,
            event: "contact_revealed",
            groups: { organization: activeOrgId },
            properties: {
              candidate_id: candidateId,
              type,
              had_email: !!existingContact.email,
              had_phone: !!existingContact.phone,
              got_email: emailFound,
              got_phone: phoneFound,
              email_credit_cost: emailFound ? EMAIL_CREDIT_COST : 0,
              phone_credit_cost: phoneFound ? PHONE_CREDIT_COST : 0,
            },
          });
        }

        return {
          success: true,
          alreadyRevealed: false,
          email: newEmail,
          phone: newPhone,
        };
      }

      // First time reveal - check credits first
      const wantEmail = type === "email" || type === "both";
      const wantPhone = type === "phone" || type === "both";
      const requiredCredits =
        (wantEmail ? EMAIL_CREDIT_COST : 0) +
        (wantPhone ? PHONE_CREDIT_COST : 0);

      // Check credits BEFORE making API calls
      const currentCredits = await getOrganizationCredits(activeOrgId);
      if (currentCredits < requiredCredits) {
        return {
          success: false,
          error: `Insufficient credits. You need ${requiredCredits} credits but have ${currentCredits}.`
        };
      }

      let email: string | null = null;
      let phone: string | null = null;
      let creditsCost = 0;
      let rawResponse: Record<string, unknown> = {};
      let findymailId: string | null = null;
      let findymailSource: string | null = null;

      try {
        if (wantEmail) {
          const emailResult = await findEmailByLinkedIn(candidate.linkedinUrl);
          rawResponse = { ...rawResponse, emailResult };
          if (emailResult.contact?.email) {
            email = emailResult.contact.email;
            creditsCost += EMAIL_CREDIT_COST;
            findymailSource = "business-profile";
          }
        }

        if (wantPhone) {
          const phoneResult = await findPhoneByLinkedIn(candidate.linkedinUrl);
          rawResponse = { ...rawResponse, phoneResult };
          if (phoneResult.phone) {
            phone = phoneResult.phone;
            creditsCost += PHONE_CREDIT_COST;
          }
        }
      } catch (err) {
        log.error("findymail.error", {
          source,
          candidateId,
          organizationId: activeOrgId,
          error: err instanceof Error ? err.message : String(err),
        });

        if (err instanceof FindymailError) {
          if (err.code === "NOT_ENOUGH_CREDITS") {
            return { success: false, error: "Not enough Findymail credits. Please contact support." };
          }
          return { success: false, error: err.message };
        }
        throw err;
      }

      // If no data found, still record the attempt (no credits charged)
      if (!email && !phone) {
        // Create record without charging credits
        const contactId = generateId();
        await tx.insert(candidateContacts).values({
          id: contactId,
          candidateId,
          organizationId: activeOrgId,
          revealedByUserId: userId,
          email: null,
          phone: null,
          rawResponse: JSON.stringify(rawResponse),
        });

        getPostHogServer().capture({
          distinctId: userId,
          event: "contact_reveal_no_result",
          groups: { organization: activeOrgId },
          properties: {
            candidate_id: candidateId,
            type,
            linkedin_url: candidate.linkedinUrl,
          },
        });

        return {
          success: true,
          email: null,
          phone: null,
        };
      }

      // Deduct credits separately for email and phone
      let lastTransactionId: string | undefined;

      if (email) {
        const creditResult = await deductCredits({
          organizationId: activeOrgId,
          userId,
          amount: EMAIL_CREDIT_COST,
          creditType: CREDIT_TYPES.EMAIL_REVEAL,
          relatedEntityId: candidateId,
          description: "Reveal email",
          metadata: { linkedinUrl: candidate.linkedinUrl },
        });
        if (!creditResult.success) {
          return { success: false, error: creditResult.error || "Failed to deduct credits" };
        }
        lastTransactionId = creditResult.transaction?.id;
      }

      if (phone) {
        const creditResult = await deductCredits({
          organizationId: activeOrgId,
          userId,
          amount: PHONE_CREDIT_COST,
          creditType: CREDIT_TYPES.PHONE_REVEAL,
          relatedEntityId: candidateId,
          description: "Reveal phone",
          metadata: { linkedinUrl: candidate.linkedinUrl },
        });
        if (!creditResult.success) {
          return { success: false, error: creditResult.error || "Failed to deduct credits" };
        }
        lastTransactionId = creditResult.transaction?.id;
      }

      // Store the revealed contact
      const contactId = generateId();
      await tx.insert(candidateContacts).values({
        id: contactId,
        candidateId,
        organizationId: activeOrgId,
        revealedByUserId: userId,
        email,
        phone,
        findymailId,
        findymailSource,
        rawResponse: JSON.stringify(rawResponse),
        creditTransactionId: lastTransactionId,
      });

      getPostHogServer().capture({
        distinctId: userId,
        event: "contact_revealed",
        groups: { organization: activeOrgId },
        properties: {
          candidate_id: candidateId,
          type,
          got_email: !!email,
          got_phone: !!phone,
          email_credit_cost: email ? EMAIL_CREDIT_COST : 0,
          phone_credit_cost: phone ? PHONE_CREDIT_COST : 0,
        },
      });

      return {
        success: true,
        email,
        phone,
        creditTransactionId: lastTransactionId,
      };
    });
  } catch (err) {
    log.error("reveal_contact.error", {
      source,
      candidateId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reveal contact",
    };
  }
}

/**
 * Get revealed contact for a candidate if it exists for the current organization
 */
export async function getRevealedContact(candidateId: string): Promise<{
  email: string | null;
  phone: string | null;
  isRevealed: boolean;
} | null> {
  try {
    const { activeOrgId } = await getSessionWithOrg();

    const contact = await db.query.candidateContacts.findFirst({
      where: and(
        eq(candidateContacts.candidateId, candidateId),
        eq(candidateContacts.organizationId, activeOrgId)
      ),
      columns: {
        email: true,
        phone: true,
      },
    });

    if (!contact) {
      return null;
    }

    return {
      email: contact.email,
      phone: contact.phone,
      isRevealed: true,
    };
  } catch {
    return null;
  }
}

/**
 * Batch get revealed contacts for multiple candidates
 */
export async function getRevealedContactsBatch(candidateIds: string[]): Promise<
  Map<string, { email: string | null; phone: string | null }>
> {
  const result = new Map<string, { email: string | null; phone: string | null }>();

  if (candidateIds.length === 0) {
    return result;
  }

  try {
    const { activeOrgId } = await getSessionWithOrg();

    const contacts = await db.query.candidateContacts.findMany({
      where: and(
        eq(candidateContacts.organizationId, activeOrgId)
      ),
      columns: {
        candidateId: true,
        email: true,
        phone: true,
      },
    });

    for (const contact of contacts) {
      if (candidateIds.includes(contact.candidateId)) {
        result.set(contact.candidateId, {
          email: contact.email,
          phone: contact.phone,
        });
      }
    }
  } catch {
    // Return empty map on error
  }

  return result;
}
