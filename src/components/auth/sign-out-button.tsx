"use client";

import { Button } from "@/components/ui/button";
import posthog from "posthog-js";

export function SignOutButton({ invitationId }: { invitationId: string }) {
  const handleSignOut = () => {
    posthog.capture("user_signed_out", { reason: "account_switch" });
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
