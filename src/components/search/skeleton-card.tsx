"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";

interface SkeletonCardProps {
  index?: number;
}

export function SkeletonCard({ index = 0 }: SkeletonCardProps) {
  return (
    <div className="group relative rounded-lg bg-white p-4 border border-gray-200">
      <div className="flex gap-4">
        {/* Left column: Checkbox */}
        <div className="flex items-start pt-1 shrink-0">
          <Skeleton className="h-4 w-4 rounded" />
        </div>

        {/* Middle column: Profile content */}
        <div className="flex-1 min-w-0">
          <div className="flex gap-4 mb-4">
            {/* Avatar skeleton */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div className="relative w-[72px] h-[72px] flex items-center justify-center">
                <Skeleton className="h-16 w-16 rounded-full" />
              </div>
            </div>

            {/* Name and role skeleton */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>

          {/* Criteria badges skeleton */}
          <div className="flex flex-wrap gap-1 items-center mb-3">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>

          {/* Summary skeleton */}
          <div className="pt-3 border-t border-gray-200 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>

        {/* Right column: Action buttons */}
        <div className="flex items-start shrink-0">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
