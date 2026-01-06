"use client";

import { useSession } from "@/lib/auth-client";
import { useMemo } from "react";

/**
 * Get user context for logging on the client.
 * Use this in client components to get userId/organizationId for logs.
 *
 * @example
 * import { useLogger } from "@/lib/axiom/client";
 * import { useUserContext } from "@/hooks/use-user-context";
 *
 * export function MyComponent({ itemId }: { itemId: string }) {
 *   const log = useLogger();
 *   const ctx = useUserContext();
 *
 *   const handleClick = () => {
 *     log.info("Clicked", { ...ctx, itemId });
 *   };
 *
 *   return <button onClick={handleClick}>Go</button>;
 * }
 */
export function useUserContext() {
  const { data: session } = useSession();

  return useMemo(
    () => ({
      userId: session?.user?.id ?? null,
      organizationId: session?.session?.activeOrganizationId ?? null,
    }),
    [session?.user?.id, session?.session?.activeOrganizationId]
  );
}
