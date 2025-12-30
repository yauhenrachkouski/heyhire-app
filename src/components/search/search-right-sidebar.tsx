"use client";

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { IconX } from "@tabler/icons-react";
import { CandidateDetails } from "./candidate-details";
import { getSearchCandidateById } from "@/actions/candidates";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { searchCandidatesKeys } from "@/lib/query-keys/search";

function CandidateDetailsSkeleton() {
  return (
    <div className="relative flex flex-col h-full bg-white">
      {/* Floating close button skeleton */}
      <div className="sticky top-2 z-20 flex justify-end px-2 pt-2">
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-4 pt-2">
          <div className="space-y-6">
            {/* Profile Header */}
            <div>
              <div className="flex gap-4 mb-4">
                {/* Avatar skeleton */}
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <Skeleton className="h-16 w-16 rounded-full" />
                </div>

                {/* Name and role skeleton */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>

              {/* Criteria badges skeleton */}
              <div className="flex flex-wrap gap-2 mb-3">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            </div>

            {/* Action Buttons skeleton */}
            <div className="flex flex-col gap-2">
              <Skeleton className="h-9 w-full rounded-md" />
            </div>

            {/* <Separator /> */}

            {/* Summary skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>

            {/* <Separator /> */}

            {/* About section skeleton */}
            <div>
              <Skeleton className="h-4 w-16 mb-3" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>

            <Separator />

            {/* Experience section skeleton */}
            <div>
              <Skeleton className="h-4 w-24 mb-4" />
              <div className="ml-2 border-l border-muted space-y-6 pb-2">
                {[1, 2].map((i) => (
                  <div key={i} className="relative pl-6">
                    <div className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border border-muted-foreground bg-background" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Skills section skeleton */}
            <div>
              <Skeleton className="h-4 w-20 mb-3" />
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-6 w-20 rounded-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export function SearchRightSidebar() {
  const searchParams = useSearchParams();
  const candidateId = searchParams.get("candidateId");
  const router = useRouter();
  const pathname = usePathname();
  const { setOpen } = useSidebar();

  // Control sidebar open state based on candidateId presence
  React.useEffect(() => {
    setOpen(!!candidateId);
  }, [candidateId, setOpen]);

  const handleClose = React.useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("candidateId");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // Fetch candidate details
  const { data: candidateResult, isLoading } = useQuery({
    queryKey: searchCandidatesKeys.detail(candidateId || ""),
    queryFn: async () => {
      if (!candidateId) return null;
      return await getSearchCandidateById(candidateId);
    },
    enabled: !!candidateId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const searchCandidate = candidateResult?.success ? candidateResult.data : null;
  const sourcingCriteria = React.useMemo(() => {
    if (!searchCandidate?.search?.parseResponse) return undefined;
    try {
      return JSON.parse(searchCandidate.search.parseResponse);
    } catch {
      return undefined;
    }
  }, [searchCandidate]);

  if (!candidateId) {
    return null;
  }

  return (
    <Sidebar
      side="right"
      variant="floating"
      collapsible="none"
      className="shrink-0 border-l bg-background shadow-none min-w-[500px] w-[600px] p-0 hidden md:flex sticky top-4 h-[calc(100svh-2rem)] overflow-hidden"
    >
      <div className="flex h-full flex-col overflow-hidden">
        {isLoading ? (
          <CandidateDetailsSkeleton />
        ) : candidateResult?.success && candidateResult.data ? (
          <CandidateDetails
            searchCandidate={searchCandidate as any}
            onClose={handleClose}
            sourcingCriteria={sourcingCriteria}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
            <p className="text-muted-foreground">Candidate not found</p>
            <Button variant="outline" size="sm" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </Sidebar>
  );
}

