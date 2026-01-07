"use client";

import { Button } from "@/components/ui/button";
import posthog from "posthog-js";

export function SignOutButton({ invitationId }: { invitationId: string }) {
  const handleSignOut = () => {
    // Reset PostHog before sign out (event tracked server-side)
    posthog.reset();
    // Import signOut dynamically to avoid SSR issues
    import("@/lib/auth-client").then(({ signOut }) => {
      signOut().then(() => {
        window.location.href = `/auth/signin?callbackUrl=/auth/accept-invitation/${invitationId}`;
      });
    });
  };

  return (
    <Button
      onClick={handleSignOut}
      className="w-full"
      variant="outline"
    >
      Sign In with Different Account
    </Button>
  );
}
