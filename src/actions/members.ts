"use server";

import { log } from "@/lib/axiom/server-log";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getErrorMessage } from "@/lib/handle-error";
import { db } from "@/db/drizzle";
import { member, organization, user } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Resend } from "resend";
import { MemberRemovedEmail } from "@/emails";

const resend = new Resend(process.env.RESEND_API_KEY);

// Types
export type Member = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
  status: "active" | "pending";
  invitationId?: string;
  email?: string;
};

export type GetMembersResult = {
  data: Member[];
  total: number;
};

/**
 * Get members for the active organization
 * Combines active members and pending invitations
 */
export async function getMembers(input?: {
  limit?: number;
  offset?: number;
}): Promise<GetMembersResult> {
  try {
    const limit = input?.limit || 100;
    const offset = input?.offset || 0;

    // Fetch active members using Better Auth
    const membersResponse = await auth.api.listMembers({
      query: {
        limit,
        offset,
      },
      headers: await headers(),
    });

    // Fetch pending invitations using Better Auth
    const invitationsResponse = await auth.api.listInvitations({
      headers: await headers(),
    });

    // Transform active members to our Member type
    const activeMembers: Member[] = (membersResponse?.members || []).map((member: Record<string, unknown>) => ({
      id: member.id as string,
      organizationId: member.organizationId as string,
      userId: member.userId as string,
      role: member.role as string,
      createdAt: member.createdAt as Date,
      user: {
        id: (member.user as Record<string, unknown>).id as string,
        name: (member.user as Record<string, unknown>).name as string,
        email: (member.user as Record<string, unknown>).email as string,
      },
      status: "active" as const,
    }));

    // Transform pending invitations to our Member type
    const pendingMembers: Member[] = (invitationsResponse || [])
      .filter((inv: Record<string, unknown>) => inv.status === "pending")
      .map((inv: Record<string, unknown>) => ({
        id: inv.id as string,
        organizationId: inv.organizationId as string,
        userId: "",
        role: inv.role as string,
        createdAt: new Date(), // Invitations may not have createdAt in the response
        user: {
          id: "",
          name: (inv.email as string).split("@")[0],
          email: inv.email as string,
        },
        status: "pending" as const,
        invitationId: inv.id as string,
        email: inv.email as string,
      }));

    // Combine both lists
    const combinedData = [...activeMembers, ...pendingMembers];

    return {
      data: combinedData,
      total: combinedData.length,
    };
  } catch (error) {
    log.error("Members", "Error fetching members", { error });
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Remove a member from the organization
 */
export async function removeMember(memberIdOrEmail: string) {
  try {
    const reqHeaders = await headers();

    const session = await auth.api.getSession({ headers: reqHeaders });
    const removedMember = await db.query.member.findFirst({
      where: eq(member.id, memberIdOrEmail),
      with: { user: true, organization: true },
    });
    const removedUserByEmail = !removedMember
      ? await db.query.user.findFirst({
          where: eq(user.email, memberIdOrEmail),
          columns: { id: true, email: true, name: true },
        })
      : null;
    const removedMemberByEmail = removedUserByEmail
      ? await db.query.member.findFirst({
          where: eq(member.userId, removedUserByEmail.id),
          with: { organization: true },
        })
      : null;

    await auth.api.removeMember({
      body: {
        memberIdOrEmail,
      },
      headers: reqHeaders,
    });

    try {
      const removedEmail = removedMember?.user?.email || removedUserByEmail?.email;
      const removedNameOrEmail = removedMember?.user?.name || removedUserByEmail?.name || removedEmail;
      const orgId = removedMember?.organizationId || removedMemberByEmail?.organizationId;

      if (removedEmail && orgId && session?.user?.email) {
        const orgRecord = await db.query.organization.findFirst({
          where: eq(organization.id, orgId),
          columns: { name: true },
        });

        const removedByNameOrEmail = session.user.name || session.user.email;

        const emailContent = MemberRemovedEmail({
          removedUserNameOrEmail: removedNameOrEmail || removedEmail,
          organizationName: orgRecord?.name || orgId,
          removedByNameOrEmail,
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/signin`,
        });

        await resend.emails.send({
          from: process.env.EMAIL_FROM as string,
          to: removedEmail,
          subject: `You were removed from ${orgRecord?.name || "a workspace"}`,
          react: emailContent,
        });
      }
    } catch (e) {
      log.warn("Members", "Failed to send member removed email", { error: e });
    }

    return {
      success: true,
      message: "Member removed successfully",
    };
  } catch (error) {
    log.error("Members", "Error removing member", { error });
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Update a member's role
 */
export async function updateMemberRole(memberId: string, role: string) {
  try {
    await auth.api.updateMemberRole({
      body: {
        memberId,
        role,
      },
      headers: await headers(),
    });

    return {
      success: true,
      message: "Member role updated successfully",
    };
  } catch (error) {
    log.error("Members", "Error updating member role", { error });
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Update a single member - wrapper for UI compatibility
 * Uses native better-auth updateMemberRole
 */
export async function updateMember(input: { id: string; role: string }) {
  return updateMemberRole(input.id, input.role);
}

/**
 * Update multiple members' roles
 * Uses native better-auth updateMemberRole in batch
 */
export async function updateMembers(input: { ids: string[]; role: string }) {
  try {
    const reqHeaders = await headers();
    const results = await Promise.allSettled(
      input.ids.map((id) => 
        auth.api.updateMemberRole({
          body: {
            memberId: id,
            role: input.role,
          },
          headers: reqHeaders,
        })
      )
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      log.error("Members", "Some member updates failed", { failures });
      return {
        success: false,
        error: `Failed to update ${failures.length} of ${input.ids.length} members`,
      };
    }

    return {
      success: true,
      message: `Successfully updated ${input.ids.length} members`,
    };
  } catch (error) {
    log.error("Members", "Error updating members", { error });
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}

/**
 * Delete multiple members from the organization
 * Handles both active members and pending invitations
 * Uses native better-auth removeMember and cancelInvitation
 */
export async function deleteMembers(input: { ids: string[] }) {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({ headers: reqHeaders });

    const results = await Promise.allSettled(
      input.ids.map(async (id) => {
        const removedMember = await db.query.member.findFirst({
          where: eq(member.id, id),
          with: { user: true, organization: true },
        });
        const removedUserByEmail = !removedMember
          ? await db.query.user.findFirst({
              where: eq(user.email, id),
              columns: { id: true, email: true, name: true },
            })
          : null;
        const removedMemberByEmail = removedUserByEmail
          ? await db.query.member.findFirst({
              where: eq(member.userId, removedUserByEmail.id),
              with: { organization: true },
            })
          : null;

        // Try to remove as member first (works for both member ID and email)
        try {
          await auth.api.removeMember({
            body: {
              memberIdOrEmail: id,
            },
            headers: reqHeaders,
          });

          try {
            const removedEmail = removedMember?.user?.email || removedUserByEmail?.email;
            const removedNameOrEmail =
              removedMember?.user?.name || removedUserByEmail?.name || removedEmail;
            const orgId = removedMember?.organizationId || removedMemberByEmail?.organizationId;

            if (removedEmail && orgId && session?.user?.email) {
              const orgRecord = await db.query.organization.findFirst({
                where: eq(organization.id, orgId),
                columns: { name: true },
              });

              const removedByNameOrEmail = session.user.name || session.user.email;

              const emailContent = MemberRemovedEmail({
                removedUserNameOrEmail: removedNameOrEmail || removedEmail,
                organizationName: orgRecord?.name || orgId,
                removedByNameOrEmail,
                ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/signin`,
              });

              await resend.emails.send({
                from: process.env.EMAIL_FROM as string,
                to: removedEmail,
                subject: `You were removed from ${orgRecord?.name || "a workspace"}`,
                react: emailContent,
              });
            }
          } catch (e) {
            log.warn("Members", "Failed to send member removed email", { error: e });
          }
        } catch {
          // If removeMember fails, try to cancel as invitation
          await auth.api.cancelInvitation({
            body: {
              invitationId: id,
            },
            headers: reqHeaders,
          });
        }
      })
    );

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      log.error("Members", "Some member deletions failed", { failures });
      return {
        success: false,
        error: `Failed to remove ${failures.length} of ${input.ids.length} members`,
      };
    }

    return {
      success: true,
      message: `Successfully removed ${input.ids.length} members`,
    };
  } catch (error) {
    log.error("Members", "Error deleting members", { error });
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
