"use server";

import { db } from "@/db/drizzle";
import { invitation, organization } from "@/db/schema";
import { getErrorMessage } from "@/lib/handle-error";
import { generateId } from "@/lib/id";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

// Schema for inviting a member
const inviteMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["owner", "admin", "member"], {
    errorMap: () => ({ message: "Role must be owner, admin, or member" }),
  }),
  organizationId: z.string().min(1, "Organization ID is required"),
});

// Types
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// Send invitation email (placeholder - implement with your email service)
async function sendInvitationEmail(email: string, organizationName: string, inviterName: string, invitationId: string) {
  // TODO: Implement email sending with your email service (Resend, SendGrid, etc.)
  console.log(`Sending invitation email to ${email} from ${inviterName} for organization ${organizationName}`);
  console.log(`Invitation link: ${process.env.NEXT_PUBLIC_SITE_URL}/invite/${invitationId}`);
  
  // For now, just log the invitation
  // In production, you would send an actual email with a link like:
  // https://yourdomain.com/invite/{invitationId}
}

// Invite a new member to the organization
export async function inviteMember(input: InviteMemberInput) {
  try {
    // Validate input
    const validatedInput = inviteMemberSchema.parse(input);

    // Get current user session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to invite members",
      };
    }

    // Get organization details
    const org = await db.query.organization.findFirst({
      where: eq(organization.id, validatedInput.organizationId),
    });

    if (!org) {
      return {
        success: false,
        error: "Organization not found",
      };
    }

    // Check if user already has an invitation pending
    const existingInvitation = await db.query.invitation.findFirst({
      where: (invitation, { and, eq }) =>
        and(
          eq(invitation.email, validatedInput.email),
          eq(invitation.organizationId, validatedInput.organizationId),
          eq(invitation.status, "pending")
        ),
    });

    if (existingInvitation) {
      return {
        success: false,
        error: "An invitation has already been sent to this email",
      };
    }

    // Create invitation with 7 days expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitationId = generateId();

    await db.insert(invitation).values({
      id: invitationId,
      organizationId: validatedInput.organizationId,
      email: validatedInput.email,
      role: validatedInput.role,
      status: "pending",
      expiresAt,
      inviterId: session.user.id,
    });

    // Send invitation email
    await sendInvitationEmail(
      validatedInput.email,
      org.name,
      session.user.name || session.user.email,
      invitationId
    );

    revalidatePath("/members");

    return {
      success: true,
      message: `Invitation sent to ${validatedInput.email}`,
    };
  } catch (error) {
    console.error("Error inviting member:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

// Get pending invitations for an organization
export async function getInvitations(organizationId: string) {
  try {
    const invitations = await db.query.invitation.findMany({
      where: eq(invitation.organizationId, organizationId),
    });

    return {
      success: true,
      data: invitations,
    };
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return {
      success: false,
      error: getErrorMessage(error),
      data: [],
    };
  }
}

// Cancel/Revoke an invitation
export async function revokeInvitation(invitationId: string) {
  try {
    // Get current user session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return {
        success: false,
        error: "You must be logged in to revoke invitations",
      };
    }

    await db
      .update(invitation)
      .set({ status: "canceled" })
      .where(eq(invitation.id, invitationId));

    revalidatePath("/members");
    revalidatePath("/organization");

    return {
      success: true,
      message: "Invitation revoked successfully",
    };
  } catch (error) {
    console.error("Error revoking invitation:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

// Alias for backward compatibility
export const cancelInvitation = revokeInvitation;

