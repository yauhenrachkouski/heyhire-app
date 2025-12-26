"use client";

import { SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { useRef, useState, useEffect } from "react";

interface RecentSearch {
  id: string;
  name: string;
  query: string;
  createdAt: string | Date;
}

interface RecentSearchesProps {
  searches: RecentSearch[];
  isLoading?: boolean;
  currentPath?: string;
  basePath?: string;
}

function RecentSearchItem({
  search,
  isActive,
  basePath,
}: {
  search: RecentSearch;
  isActive: boolean;
  basePath: string;
}) {
  const { state } = useSidebar();
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (element && state === "expanded") {
      setIsTruncated(element.scrollWidth > element.clientWidth);
    }
  }, [search.name, state]);

  const searchPath = `${basePath}/search/${search.id}`;

  const button = (
    <SidebarMenuButton 
      asChild 
      isActive={isActive}
      tooltip={search.name}
    >
      <Link href={searchPath} className="w-full">
        <span ref={textRef} className="truncate block max-w-full">{search.name}</span>
      </Link>
    </SidebarMenuButton>
  );

  // Show tooltip when expanded and text is truncated
  if (state === "expanded" && isTruncated) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {button}
        </TooltipTrigger>
        <TooltipContent side="right" align="center">
          {search.name}
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

export function RecentSearches({
  searches,
  isLoading = false,
  currentPath,
  basePath = "",
}: RecentSearchesProps) {
  if (isLoading) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        Loading recent searches...
      </div>
    );
  }

  if (!searches || searches.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        No recent searches
      </div>
    );
  }

  return (
    <>
      {searches.map((search) => {
        const searchPath = `${basePath}/search/${search.id}`;
        const isActive = currentPath === searchPath;
        
        return (
          <SidebarMenuItem key={search.id}>
            <RecentSearchItem search={search} isActive={isActive} basePath={basePath} />
          </SidebarMenuItem>
        );
      })}
    </>
  );
}
