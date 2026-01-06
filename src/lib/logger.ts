import { auth } from "@/lib/auth";
import { headers } from "next/headers";

/**
 * Get user context for logging on the server.
 * Call this once at the start of server actions/API routes.
 *
 * @example
 * import { log } from "@axiomhq/next";
 * import { getUserContext } from "@/lib/logger";
 *
 * export async function createItem(itemId: string) {
 *   const ctx = await getUserContext();
 *   log.info("Creating item", { ...ctx, itemId });
 * }
 */
export async function getUserContext() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return {
      userId: session?.user?.id ?? null,
      organizationId: session?.session?.activeOrganizationId ?? null,
    };
  } catch {
    return {
      userId: null,
      organizationId: null,
    };
  }
}
