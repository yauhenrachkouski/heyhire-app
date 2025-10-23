"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getErrorMessage } from "@/lib/handle-error";

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
    const activeMembers: Member[] = (membersResponse?.members || []).map((member: any) => ({
      id: member.id,
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
      },
      status: "active" as const,
    }));

    // Transform pending invitations to our Member type
    const pendingMembers: Member[] = (invitationsResponse || [])
      .filter((inv: any) => inv.status === "pending")
      .map((inv: any) => ({
        id: inv.id,
        organizationId: inv.organizationId,
        userId: "",
        role: inv.role,
        createdAt: new Date(), // Invitations may not have createdAt in the response
        user: {
          id: "",
          name: inv.email.split("@")[0],
          email: inv.email,
        },
        status: "pending" as const,
        invitationId: inv.id,
        email: inv.email,
      }));

    // Combine both lists
    const combinedData = [...activeMembers, ...pendingMembers];

    return {
      data: combinedData,
      total: combinedData.length,
    };
  } catch (error) {
    console.error("Error fetching members:", error);
    throw new Error(getErrorMessage(error));
  }
}

/**
 * Remove a member from the organization
 */
export async function removeMember(memberIdOrEmail: string) {
  try {
    await auth.api.removeMember({
      body: {
        memberIdOrEmail,
      },
      headers: await headers(),
    });

    return {
      success: true,
      message: "Member removed successfully",
    };
  } catch (error) {
    console.error("Error removing member:", error);
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
    console.error("Error updating member role:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
