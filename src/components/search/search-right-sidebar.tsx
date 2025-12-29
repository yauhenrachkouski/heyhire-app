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
    queryKey: ["search-candidate-details", candidateId],
    queryFn: async () => {
      if (!candidateId) return null;
      return await getSearchCandidateById(candidateId);
    },
    enabled: !!candidateId,
  });

  const searchCandidate = candidateResult?.data;
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
          <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : candidateResult?.success && candidateResult.data ? (
          <CandidateDetails
            searchCandidate={searchCandidate as any}
            onClose={handleClose}
            sourcingCriteria={sourcingCriteria}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <p className="text-muted-foreground">Candidate not found</p>
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </Sidebar>
  );
}

