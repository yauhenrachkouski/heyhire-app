"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { revealCandidateContact, type RevealContactType, type RevealContactResult } from "@/actions/contacts";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrganization } from "@/lib/auth-client";
import { creditsKeys } from "@/lib/credits";
import { usePlansModal } from "@/providers/plans-modal-provider";
import { searchCandidatesKeys } from "@/lib/query-keys/search";
import posthog from "posthog-js";

type RevealContactParams = {
  candidateId: string;
  searchCandidateId?: string;
  type: RevealContactType;
};

export function useRevealContact() {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();
  const { data: activeOrg } = useActiveOrganization();
  const { openPlansModal } = usePlansModal();

  const revealContact = useCallback(
    async (params: RevealContactParams): Promise<RevealContactResult> => {
      setIsLoading(true);
      try {
        const result = await revealCandidateContact({
          candidateId: params.candidateId,
          type: params.type,
        });

        if (!result.success) {
          posthog.capture("contact_reveal_failed", {
            candidate_id: params.candidateId,
            type: params.type,
            error: result.error,
          });
          toast.error("Failed to reveal contact", {
            description: result.error || "Please try again",
            action: result.error?.includes("credits")
              ? {
                  label: "Upgrade",
                  onClick: () => openPlansModal(),
                }
              : undefined,
          });
          return result;
        }

        // Track contact reveal
        posthog.capture("contact_revealed", {
          candidate_id: params.candidateId,
          type: params.type,
          is_free: result.alreadyRevealed === true,
          got_email: !!result.email,
          got_phone: !!result.phone,
        });

        // Show success toast with revealed info
        if (result.email || result.phone) {
          const parts: string[] = [];
          if (result.email) parts.push("email");
          if (result.phone) parts.push("phone");
          toast.success(result.alreadyRevealed ? "Contact retrieved" : "Contact revealed", {
            description: `Found ${parts.join(" and ")}`,
          });
        } else {
          toast.info("No contact found", {
            description: "Could not find email or phone for this candidate",
          });
        }

        // Invalidate credits
        if (activeOrg?.id) {
          await queryClient.invalidateQueries({
            queryKey: creditsKeys.organization(activeOrg.id),
          });
        } else {
          await queryClient.invalidateQueries({ queryKey: creditsKeys.all });
        }

        // Update candidate lists to mark as revealed
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
                  return {
                    ...candidate,
                    isContactRevealed: true,
                    revealedEmail: result.email,
                    revealedPhone: result.phone,
                  };
                }
                return candidate;
              });
              return { ...page, candidates: nextCandidates };
            });
            return { ...oldData, pages: nextPages };
          }
        );

        // Update detail view if open
        if (params.searchCandidateId) {
          queryClient.setQueryData(
            searchCandidatesKeys.detail(params.searchCandidateId),
            (oldData: any) => {
              if (!oldData || typeof oldData !== "object") return oldData;
              const updatedData = {
                isContactRevealed: true,
                revealedEmail: result.email,
                revealedPhone: result.phone,
              };
              if ("data" in oldData) {
                return {
                  ...oldData,
                  data: { ...oldData.data, ...updatedData },
                };
              }
              return { ...oldData, ...updatedData };
            }
          );
        }

        // Invalidate to refresh from server
        await queryClient.invalidateQueries({ queryKey: searchCandidatesKeys.lists() });
        if (params.searchCandidateId) {
          await queryClient.invalidateQueries({
            queryKey: searchCandidatesKeys.detail(params.searchCandidateId),
          });
        }

        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [activeOrg?.id, openPlansModal, queryClient]
  );

  return { revealContact, isLoading };
}
