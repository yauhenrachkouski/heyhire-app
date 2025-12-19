"use client";

import { Button } from "@/components/ui/button";

export function SignOutButton({ invitationId }: { invitationId: string }) {
  const handleSignOut = () => {
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
