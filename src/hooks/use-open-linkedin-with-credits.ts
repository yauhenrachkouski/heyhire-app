"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { consumeCreditsForLinkedInOpen } from "@/actions/consumption";

export function useOpenLinkedInWithCredits() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

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

        window.open(params.linkedinUrl, "_blank", "noopener,noreferrer");
      } finally {
        setIsLoading(false);
      }
    },
    [toast]
  );

  return { openLinkedIn, isLoading };
}
