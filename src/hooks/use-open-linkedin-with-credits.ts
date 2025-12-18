"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { consumeCreditsForLinkedInOpen } from "@/actions/consumption";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrganization } from "@/lib/auth-client";
import { creditsKeys } from "@/lib/credits";
import { useRouter } from "next/navigation";
import { usePlansModal } from "@/providers/plans-modal-provider";

export function useOpenLinkedInWithCredits() {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();
  const router = useRouter();
  const { openPlansModal } = usePlansModal();

  const openLinkedIn = useCallback(
    async (params: { candidateId: string; linkedinUrl?: string | null }) => {
      if (!params.linkedinUrl) return;

      setIsLoading(true);
      try {
        const result = await consumeCreditsForLinkedInOpen({
          candidateId: params.candidateId,
          linkedinUrl: params.linkedinUrl,
        });

        if (!result.success) {
          toast.error("Not enough credits", {
            description: result.error || "Please upgrade your plan",
            action: {
              label: "Upgrade",
              onClick: () => openPlansModal(),
            },
          });
          return;
        }

        if (activeOrg?.id) {
          await queryClient.invalidateQueries({
            queryKey: creditsKeys.organization(activeOrg.id),
          });
        } else {
          await queryClient.invalidateQueries({ queryKey: creditsKeys.all });
        }

        router.refresh();

        window.open(params.linkedinUrl, "_blank", "noopener,noreferrer");
      } finally {
        setIsLoading(false);
      }
    },
    [activeOrg?.id, openPlansModal, queryClient, router]
  );

  return { openLinkedIn, isLoading };
}
