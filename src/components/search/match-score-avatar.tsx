"use client";

import { ProfileAvatar } from "@/components/custom/profile-avatar";
import { cn } from "@/lib/utils";

interface MatchScoreAvatarProps {
  matchScore: number | null;
  fullName: string | null;
  photoUrl: string | null;
  className?: string;
}

export function MatchScoreAvatar({
  matchScore,
  fullName,
  photoUrl,
  className,
}: MatchScoreAvatarProps) {
  return (
    <div className={cn("relative w-[72px] h-[72px] flex items-center justify-center", className)}>
      {matchScore !== null && (
        <svg
          className="absolute inset-0 w-full h-full transform -rotate-90"
          viewBox="0 0 72 72"
        >
          <circle
            cx="36"
            cy="36"
            r="33"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="4"
          />
          <circle
            cx="36"
            cy="36"
            r="33"
            fill="none"
            stroke={
              matchScore >= 71
                ? "#10b981"
                : matchScore >= 41
                ? "#f59e0b"
                : "#ef4444"
            }
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 33}`}
            strokeDashoffset={`${2 * Math.PI * 33 * (1 - matchScore / 100)}`}
            className="transition-all duration-500"
          />
        </svg>
      )}
      <ProfileAvatar
        className="h-16 w-16 relative z-10"
        fullName={fullName || "Unknown"}
        photoUrl={photoUrl}
      />
      {matchScore !== null && (
        <div className="absolute bottom-0 right-0 z-20 bg-white rounded-full ring-2 ring-white shadow-sm">
          <span
            className={cn(
              "text-xs font-bold px-1.5 py-0.5 block",
              matchScore >= 71
                ? "text-green-600"
                : matchScore >= 41
                ? "text-amber-600"
                : "text-red-600"
            )}
          >
            {matchScore}
          </span>
        </div>
      )}
    </div>
  );
}

