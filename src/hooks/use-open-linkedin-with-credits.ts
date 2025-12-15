"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { consumeCreditsForLinkedInOpen } from "@/actions/consumption";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrganization } from "@/lib/auth-client";
import { creditsKeys } from "@/lib/credits";
import { useRouter } from "next/navigation";

export function useOpenLinkedInWithCredits() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();
  const router = useRouter();

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
          toast({
            title: "Not enough credits",
            description: result.error || "Please upgrade your plan",
            variant: "destructive",
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
    [activeOrg?.id, queryClient, router, toast]
  );

  return { openLinkedIn, isLoading };
}
