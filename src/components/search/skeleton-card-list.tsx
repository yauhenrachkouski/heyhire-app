"use client";

import { SkeletonCard } from "./skeleton-card";

interface SkeletonCardListProps {
  count?: number;
}

export function SkeletonCardList({ count = 10 }: SkeletonCardListProps) {
  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Skeleton scroll container */}
      <div
        className="relative overflow-y-auto"
        style={{
          height: "700px",
          width: "100%",
        }}
      >
        <div className="space-y-3">
          {Array.from({ length: count }).map((_, index) => (
            <SkeletonCard key={index} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
