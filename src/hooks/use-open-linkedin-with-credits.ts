"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { consumeCreditsForLinkedInOpen } from "@/actions/consumption";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrganization } from "@/lib/auth-client";
import { creditsKeys } from "@/lib/credits";
import { usePlansModal } from "@/providers/plans-modal-provider";
import { searchCandidatesKeys } from "@/lib/query-keys/search";
import posthog from "posthog-js";

type OpenLinkedInParams = {
  candidateId: string;
  linkedinUrl?: string | null;
  searchCandidateId?: string;
};

export function useOpenLinkedInWithCredits() {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();
  const { openPlansModal } = usePlansModal();

  const openLinkedIn = useCallback(
    async (params: OpenLinkedInParams) => {
      if (!params.linkedinUrl) return;

      setIsLoading(true);
      try {
        const result = await consumeCreditsForLinkedInOpen({
          candidateId: params.candidateId,
          linkedinUrl: params.linkedinUrl,
        });

        if (!result.success) {
          posthog.capture("linkedin_reveal_failed", {
            candidate_id: params.candidateId,
            error: result.error,
          });
          toast.error("Not enough credits", {
            description: result.error || "Please upgrade your plan",
            action: {
              label: "Upgrade",
              onClick: () => openPlansModal(),
            },
          });
          return result;
        }

        // Track LinkedIn reveal - distinguish paid vs free (already revealed)
        posthog.capture("linkedin_revealed", {
          candidate_id: params.candidateId,
          is_free: result.alreadyCharged === true,
          cost_credits: result.alreadyCharged ? 0 : 1,
        });

        if (activeOrg?.id) {
          await queryClient.invalidateQueries({
            queryKey: creditsKeys.organization(activeOrg.id),
          });
        } else {
          await queryClient.invalidateQueries({ queryKey: creditsKeys.all });
        }

        queryClient.setQueriesData(
          { queryKey: searchCandidatesKeys.lists() },
          (oldData: any) => {
            if (!oldData || typeof oldData !== "object" || !Array.isArray(oldData.pages)) {
              return oldData;
            }
            const nextPages = oldData.pages.map((page: any) => {
              if (!page || !Array.isArray(page.candidates)) return page;
              const nextCandidates = page.candidates.map((candidate: any) => {
                if (!candidate) return candidate;
                const matchesCandidateId = candidate.candidateId === params.candidateId;
                const matchesSearchCandidateId =
                  params.searchCandidateId && candidate.id === params.searchCandidateId;
                if (matchesCandidateId || matchesSearchCandidateId) {
                  return { ...candidate, isRevealed: true };
                }
                return candidate;
              });
              return { ...page, candidates: nextCandidates };
            });
            return { ...oldData, pages: nextPages };
          }
        );

        if (params.searchCandidateId) {
          queryClient.setQueryData(
            searchCandidatesKeys.detail(params.searchCandidateId),
            (oldData: any) => {
              if (!oldData || typeof oldData !== "object") return oldData;
              if ("data" in oldData) {
                return {
                  ...oldData,
                  data: { ...oldData.data, isRevealed: true },
                };
              }
              return { ...oldData, isRevealed: true };
            }
          );
        }

        await queryClient.invalidateQueries({ queryKey: searchCandidatesKeys.lists() });
        if (params.searchCandidateId) {
          await queryClient.invalidateQueries({
            queryKey: searchCandidatesKeys.detail(params.searchCandidateId),
          });
        }

        window.open(params.linkedinUrl, "_blank", "noopener,noreferrer");
        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [activeOrg?.id, openPlansModal, queryClient]
  );

  return { openLinkedIn, isLoading };
}
