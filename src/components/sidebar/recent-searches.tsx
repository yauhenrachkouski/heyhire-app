"use client";

import { SidebarMenuButton } from "@/components/ui/sidebar";
import { Icon } from "@/components/ui/icon";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RecentSearch {
  id: string;
  name: string;
  query: string;
  createdAt: Date;
}

interface RecentSearchesProps {
  searches: RecentSearch[];
}

export function RecentSearches({ searches }: RecentSearchesProps) {
  if (!searches || searches.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        No recent searches
      </div>
    );
  }

  return (
    <div className="max-h-[300px] overflow-y-auto">
      {searches.map((search) => (
        <Tooltip key={search.id}>
          <TooltipTrigger asChild>
            <SidebarMenuButton asChild>
              <Link href={`/search/${search.id}`} className="flex flex-col items-start gap-0.5 py-2">
                <div className="flex items-center gap-2 w-full">
                  <Icon name="search" className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1 text-sm">{search.name}</span>
                </div>
                <span className="text-xs text-muted-foreground ml-6">
                  {formatDistanceToNow(new Date(search.createdAt), { addSuffix: true })}
                </span>
              </Link>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="font-medium">{search.name}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

