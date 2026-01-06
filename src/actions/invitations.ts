"use server";

import { log } from "@/lib/axiom/server";
import { getSessionWithOrg } from "@/lib/auth-helpers";

const source = "actions/invitations";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getErrorMessage } from "@/lib/handle-error";
import { revalidatePath } from "next/cache";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { z } from "zod";
import { DISALLOWED_DOMAINS } from "@/lib/constants";

// Schema for inviting a member
const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["owner", "admin", "member"]).default("member"),
  organizationId: z.string().min(1, "Organization ID is required").optional(),
});

// Types
type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/**
 * Invite a new member to the organization using Better Auth
 */
export async function inviteMember(input: InviteMemberInput) {
  try {
    // Validate input
    const validatedInput = inviteMemberSchema.parse(input);

    // Check if email domain is allowed
    if (DISALLOWED_DOMAINS.length > 0) {
      const emailDomain = validatedInput.email.split("@")[1]?.toLowerCase();
      
      if (emailDomain && DISALLOWED_DOMAINS.includes(emailDomain)) {
        return {
          success: false,
          error: `Email addresses from ${emailDomain} are not allowed. Please use a work email address.`,
        };
      }
    }

    // Use Better Auth's inviteMember API
    await auth.api.createInvitation({
      body: {
        email: validatedInput.email,
        role: validatedInput.role,
        organizationId: validatedInput.organizationId,
      },
      headers: await headers(),
    });

    const orgId = validatedInput.organizationId ?? await getActiveOrgId();
    revalidatePath(`/${orgId}/organization`);
    revalidatePath(`/${orgId}/members`);

    return {
      success: true,
      message: `Invitation sent to ${validatedInput.email}`,
    };
  } catch (error) {
    const { userId, activeOrgId } = await getSessionWithOrg();
    log.error("invite.error", { userId, organizationId: activeOrgId, source, error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Get pending invitations for an organization
 */
export async function getInvitations(organizationId?: string) {
  try {
    const invitations = await auth.api.listInvitations({
      query: organizationId ? { organizationId } : {},
      headers: await headers(),
    });

    return {
      success: true,
      data: invitations || [],
    };
  } catch (error) {
    const { userId, activeOrgId } = await getSessionWithOrg();
    log.error("fetch.error", { userId, organizationId: activeOrgId, source, error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: getErrorMessage(error),
      data: [],
    };
  }
}

/**
 * Cancel/Revoke an invitation using Better Auth
 */
export async function cancelInvitation(invitationId: string) {
  try {
    await auth.api.cancelInvitation({
      body: {
        invitationId,
      },
      headers: await headers(),
    });

    const orgId = await getActiveOrgId();
    revalidatePath(`/${orgId}/organization`);
    revalidatePath(`/${orgId}/members`);

    return {
      success: true,
      message: "Invitation canceled successfully",
    };
  } catch (error) {
    const { userId, activeOrgId } = await getSessionWithOrg();
    log.error("cancel.error", { userId, organizationId: activeOrgId, source, error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
