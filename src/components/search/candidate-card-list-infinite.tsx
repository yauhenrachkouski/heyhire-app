"use client";

import { log } from "@/lib/axiom/client";
const source = "components/search/candidate-card-list-infinite";
import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import posthog from "posthog-js";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CandidateCard } from "./candidate-card";
import { CandidateCardActionBar } from "./candidate-card-action-bar";
import { SkeletonCard } from "./skeleton-card";
import { useActiveOrganization } from "@/lib/auth-client";
import { SourcingCriteria } from "@/types/search";
import { IconLoader2 } from "@tabler/icons-react";

// Type for candidate from database schema
interface SearchCandidate {
  id: string;
  candidate: {
    id: string;
    fullName: string | null;
    headline: string | null;
    summary?: string | null;
    photoUrl: string | null;
    location: string | null;
    linkedinUrl: string;
    linkedinUsername?: string | null;
    experiences: string | null;
    skills?: string | null;
    educations?: string | null;
    certifications?: string | null;
  };
  matchScore: number | null;
  notes: string | null;
  scoringResult?: string | null;
}

interface CandidateCardListInfiniteProps {
  candidates: SearchCandidate[];
  searchId: string;
  sourcingCriteria?: SourcingCriteria;
  viewMode?: "table" | "cards";
  onSelectionChange?: (selectedIds: string[]) => void;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isLoading?: boolean;
}

export function CandidateCardListInfinite({
  candidates,
  searchId,
  sourcingCriteria,
  viewMode = "cards",
  onSelectionChange,
  isFetchingNextPage,
  hasNextPage,
  fetchNextPage,
  isLoading = false,
}: CandidateCardListInfiniteProps) {
  const { data: activeOrg } = useActiveOrganization();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCandidateId = searchParams.get("candidateId");
  
  // Track previous candidate IDs to detect new candidates for animation
  const previousCandidateIdsRef = useRef<Set<string>>(new Set());

  // Infinite scroll trigger using IntersectionObserver
  // framer-motion's useInView has issues with dynamic content, so use native observer
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          log.info("Triggering fetchNextPage", { source });
          fetchNextPage();
        }
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  // Re-attach observer when candidates change (important for SSR -> client transition)
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, candidates.length]);

  // Reset trigger flag when fetching completes
  useEffect(() => {
    if (!isFetchingNextPage) {
      hasTriggeredRef.current = false;
    }
  }, [isFetchingNextPage]);

  const handleShowCandidate = useCallback((candidate: SearchCandidate) => {
    posthog.capture("candidate_details_viewed", {
      search_id: searchId,
      organization_id: activeOrg?.id,
      candidate_id: candidate.candidate.id,
    });
    
    // Update URL to show sidebar
    const params = new URLSearchParams(searchParams);
    params.set("candidateId", candidate.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeOrg?.id, searchId, searchParams, pathname, router]);

  const handleEmail = useCallback(() => {
    log.info("Send email not implemented yet", { source });
  }, []);

  const handlePhone = useCallback(() => {
    log.info("Call not implemented yet", { source });
  }, []);

  // Handle candidate selection
  const handleSelectCandidate = useCallback((candidateId: string, selected: boolean | "indeterminate") => {
    const isSelected = selected === true;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(candidateId);
      } else {
        next.delete(candidateId);
      }
      return next;
    });
  }, []);

  // Notify parent when selection changes
  useEffect(() => {
    onSelectionChange?.([...selectedIds]);
  }, [selectedIds, onSelectionChange]);

  // Get selected candidate objects
  const selectedCandidates = candidates.filter((c) =>
    selectedIds.has(c.id)
  );

  const currentCandidateIds = useMemo(
    () => candidates.map((candidate) => candidate.id),
    [candidates],
  );
  const isAllSelected =
    currentCandidateIds.length > 0 &&
    currentCandidateIds.every((id) => selectedIds.has(id));

  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      currentCandidateIds.forEach((id) => {
        next.add(id);
      });
      return next;
    });
  }, [currentCandidateIds]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allCandidateIds = new Set(candidates.map((c) => c.id));
  const newCandidateIds = new Set(
    [...allCandidateIds].filter(id => !previousCandidateIdsRef.current.has(id))
  );
  
  useEffect(() => {
    previousCandidateIdsRef.current = allCandidateIds;
  }, [candidates]);

  // Empty state is handled by parent component
  if (candidates.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="space-y-3 mb-4">
        {candidates.map((searchCandidate, index) => {
          const candidateId = searchCandidate.id;
          const isSelected = selectedIds.has(candidateId);
          const isNewCandidate = newCandidateIds.has(candidateId);
          const isActive = selectedCandidateId === candidateId;

          return (
            <div 
              key={candidateId}
              className={[
                "cursor-pointer transition-all rounded-lg",
                // Active highlight should never be clipped (inset vs ring-offset)
                isActive ? "ring-2 ring-primary ring-inset" : "",
                // Also show highlight when keyboard focus is inside the card
                "focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset",
                isNewCandidate ? "animate-in fade-in slide-in-from-bottom-4 duration-300" : "",
              ].filter(Boolean).join(" ")}
              style={
                isNewCandidate 
                  ? { animationDelay: `${Math.min(index * 50, 300)}ms` } 
                  : undefined
              }
            >
              <CandidateCard
                searchCandidate={searchCandidate}
                sourcingCriteria={sourcingCriteria}
                isSelected={isSelected}
                isActive={isActive}
                onSelect={(selected) => handleSelectCandidate(candidateId, selected)}
                onShowCandidate={() => handleShowCandidate(searchCandidate)}
                onCardClick={() => handleShowCandidate(searchCandidate)}
                onEmail={handleEmail}
                onPhone={handlePhone}
              />
            </div>
          );
        })}
        
        {isLoading && (
          <>
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonCard key={`skeleton-initial-${index}`} index={index} />
            ))}
          </>
        )}

        <div ref={loadMoreRef} className="py-4 flex justify-center w-full min-h-[50px]">
           {isFetchingNextPage && (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <IconLoader2 className="h-6 w-6 animate-spin" />
                <span className="text-sm">Loading more candidates...</span>
              </div>
           )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <CandidateCardActionBar
          selectedIds={Array.from(selectedIds)}
          selectedCandidates={selectedCandidates.map(c => ({
            id: c.id,
            fullName: c.candidate.fullName,
            headline: c.candidate.headline,
            location: c.candidate.location,
            linkedinUrl: c.candidate.linkedinUrl,
          }))}
          onSelectAll={handleSelectAll}
          isAllSelected={isAllSelected}
          onClearSelection={handleClearSelection}
        />
      )}
    </div>
  );
}
