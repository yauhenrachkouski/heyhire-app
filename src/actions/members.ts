"use server";

import { db } from "@/db/drizzle";
import { member, organization, user, invitation } from "@/db/schema";
import { filterColumns } from "@/lib/filter-columns";
import { getErrorMessage } from "@/lib/handle-error";
import { generateId } from "@/lib/id";
import { getValidFilters } from "@/lib/data-table";
import type { ExtendedColumnFilter } from "@/types/data-table";
import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Schemas
const getMembersSchema = z.object({
  page: z.coerce.number().default(1),
  perPage: z.coerce.number().default(10),
  sort: z.string().optional(),
  filters: z.string().optional(),
  joinOperator: z.enum(["and", "or"]).optional().default("and"),
});

const createMemberSchema = z.object({
  userId: z.string().min(1, "User is required"),
  organizationId: z.string().min(1, "Organization is required"),
  role: z.string().min(1, "Role is required"),
});

const updateMemberSchema = z.object({
  id: z.string().min(1, "Member ID is required"),
  role: z.string().min(1, "Role is required"),
});

const deleteMembersSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one member must be selected"),
});

// Types
export type Member = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
  userName: string;
  userEmail: string;
  organizationName: string;
  status: "active" | "pending";
  invitationId?: string;
  expiresAt?: Date;
};

export type GetMembersResult = {
  data: Member[];
  pageCount: number;
};

// Actions
export async function getMembers(
  input: Record<string, string | string[] | undefined>,
): Promise<GetMembersResult> {
  try {
    const { page, perPage, sort, filters, joinOperator } =
      getMembersSchema.parse(input);

    const offset = (page - 1) * perPage;

    // Parse sorting
    const sortOrder = sort ? JSON.parse(sort) : [];
    const orderBy = sortOrder
      .map((item: { id: string; desc: boolean }) => {
        // Map sortable columns
        switch (item.id) {
          case "role":
            return item.desc ? desc(member.role) : asc(member.role);
          case "createdAt":
            return item.desc ? desc(member.createdAt) : asc(member.createdAt);
          case "organizationId":
            return item.desc
              ? desc(member.organizationId)
              : asc(member.organizationId);
          case "userId":
            return item.desc ? desc(member.userId) : asc(member.userId);
          default:
            return null;
        }
      })
      .filter(Boolean);

    // Parse filters - support both member table and joined columns
    const parsedFilters: {
      id: string;
      value: string | string[];
      variant: string;
      operator: string;
      filterId: string;
    }[] = filters ? JSON.parse(filters) : [];

    // Build filter conditions for both member table and joined columns
    const filterConditions: SQL[] = [];

    for (const filter of parsedFilters) {
      // Check filter completeness
      const isComplete =
        filter.operator === "isEmpty" ||
        filter.operator === "isNotEmpty" ||
        (Array.isArray(filter.value)
          ? filter.value.length > 0
          : filter.value !== "" &&
            filter.value !== null &&
            filter.value !== undefined);

      if (!isComplete) continue;

      // Handle member table columns (role, createdAt)
      if (filter.id === "role") {
        if (Array.isArray(filter.value) && filter.operator === "inArray") {
          filterConditions.push(inArray(member.role, filter.value));
        } else if (
          typeof filter.value === "string" &&
          filter.operator === "eq"
        ) {
          filterConditions.push(eq(member.role, filter.value));
        }
      } else if (filter.id === "createdAt") {
        // Let filterColumns handle date filtering for member table
        const memberFilters = getValidFilters<typeof member>([
          filter as unknown as ExtendedColumnFilter<typeof member>,
        ]);
        if (memberFilters.length > 0) {
          const condition = filterColumns({
            table: member,
            filters: memberFilters,
            joinOperator: "and",
          });
          if (condition) filterConditions.push(condition);
        }
      }
      // Handle joined columns (userName, organizationName)
      else if (filter.id === "userName") {
        if (filter.operator === "iLike" && typeof filter.value === "string") {
          filterConditions.push(ilike(user.name, `%${filter.value}%`));
        } else if (filter.operator === "eq" && typeof filter.value === "string") {
          filterConditions.push(eq(user.name, filter.value));
        }
      } else if (filter.id === "organizationName") {
        if (filter.operator === "iLike" && typeof filter.value === "string") {
          filterConditions.push(
            ilike(organization.name, `%${filter.value}%`),
          );
        } else if (filter.operator === "eq" && typeof filter.value === "string") {
          filterConditions.push(eq(organization.name, filter.value));
        }
      }
    }

    // Combine filter conditions with join operator
    const where =
      filterConditions.length > 0
        ? joinOperator === "and"
          ? and(...filterConditions)
          : or(...filterConditions)
        : undefined;

    // Get active organization ID
    const activeOrganization = await auth.api.getFullOrganization({
      headers: await headers(),
    });
    const orgId = activeOrganization?.id;

    // Fetch active members with joins
    const activeMembers = await db
      .select({
        id: member.id,
        organizationId: member.organizationId,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
        userName: user.name,
        userEmail: user.email,
        organizationName: organization.name,
      })
      .from(member)
      .leftJoin(user, eq(member.userId, user.id))
      .leftJoin(organization, eq(member.organizationId, organization.id))
      .where(where)
      .orderBy(...(orderBy.length > 0 ? orderBy : [desc(member.createdAt)]));

    // Fetch pending invitations for the current organization
    const pendingInvitations = orgId
      ? await db
          .select({
            id: invitation.id,
            organizationId: invitation.organizationId,
            email: invitation.email,
            role: invitation.role,
            status: invitation.status,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
            organizationName: organization.name,
          })
          .from(invitation)
          .leftJoin(organization, eq(invitation.organizationId, organization.id))
          .where(
            and(
              eq(invitation.organizationId, orgId),
              eq(invitation.status, "pending")
            )
          )
          .orderBy(desc(invitation.createdAt))
      : [];

    // Combine active members and pending invitations
    const combinedData: Member[] = [
      ...activeMembers.map((m) => ({
        id: m.id,
        organizationId: m.organizationId,
        userId: m.userId,
        role: m.role || "member",
        createdAt: m.createdAt,
        userName: m.userName || "Unknown",
        userEmail: m.userEmail || "",
        organizationName: m.organizationName || "",
        status: "active" as const,
      })),
      ...pendingInvitations.map((inv) => ({
        id: inv.id,
        organizationId: inv.organizationId,
        userId: "", // No user yet for pending invitations
        role: inv.role || "member",
        createdAt: inv.createdAt,
        userName: inv.email.split("@")[0], // Use email prefix as name
        userEmail: inv.email,
        organizationName: inv.organizationName || "",
        status: "pending" as const,
        invitationId: inv.id,
        expiresAt: inv.expiresAt,
      })),
    ];

    // Apply pagination to combined data
    const paginatedData = combinedData.slice(offset, offset + perPage);

    const total = combinedData.length;
    const pageCount = Math.ceil(total / perPage);

    return {
      data: paginatedData,
      pageCount,
    };
  } catch (error) {
    console.error("Error fetching members:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function createMember(input: z.infer<typeof createMemberSchema>) {
  try {
    const validatedInput = createMemberSchema.parse(input);

    const [newMember] = await db
      .insert(member)
      .values({
        id: generateId(),
        userId: validatedInput.userId,
        organizationId: validatedInput.organizationId,
        role: validatedInput.role,
        createdAt: new Date(),
      })
      .returning();

    revalidatePath("/members");

    return {
      data: newMember,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
    };
  }
}

export async function updateMember(input: z.infer<typeof updateMemberSchema>) {
  try {
    const validatedInput = updateMemberSchema.parse(input);

    const [updatedMember] = await db
      .update(member)
      .set({
        role: validatedInput.role,
      })
      .where(eq(member.id, validatedInput.id))
      .returning();

    revalidatePath("/members");

    return {
      data: updatedMember,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
    };
  }
}

export async function updateMembers(
  input: z.infer<typeof deleteMembersSchema> & { role: string },
) {
  try {
    const validatedInput = deleteMembersSchema
      .extend({ role: z.string().min(1, "Role is required") })
      .parse(input);

    await db
      .update(member)
      .set({
        role: validatedInput.role,
      })
      .where(inArray(member.id, validatedInput.ids));

    revalidatePath("/members");

    return {
      data: null,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
    };
  }
}

export async function deleteMembers(
  input: z.infer<typeof deleteMembersSchema>,
) {
  try {
    const validatedInput = deleteMembersSchema.parse(input);

    await db.delete(member).where(inArray(member.id, validatedInput.ids));

    revalidatePath("/members");

    return {
      data: null,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
    };
  }
}

