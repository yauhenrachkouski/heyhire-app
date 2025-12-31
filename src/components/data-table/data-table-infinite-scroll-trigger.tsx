"use client";

import { useInView } from "framer-motion";
import { useEffect, useRef } from "react";
import { IconLoader2 } from "@tabler/icons-react";

interface DataTableInfiniteScrollTriggerProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export function DataTableInfiniteScrollTrigger({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: DataTableInfiniteScrollTriggerProps) {
  const loadMoreRef = useRef(null);
  const isInView = useInView(loadMoreRef, { margin: "0px 0px 200px 0px" });

  useEffect(() => {
    if (isInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!hasNextPage && !isFetchingNextPage) return null;

  return (
    <div ref={loadMoreRef} className="py-4 flex justify-center w-full min-h-[50px]">
      {isFetchingNextPage && (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <IconLoader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading more...</span>
        </div>
      )}
    </div>
  );
}

