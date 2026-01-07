"use client";

import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import { IconLoader2, IconExternalLink, IconCoin } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOpenLinkedInWithCredits } from "@/hooks/use-open-linkedin-with-credits";
import { cn } from "@/lib/utils";

type OpenLinkedInButtonProps = {
  candidateId: string;
  searchCandidateId?: string;
  linkedinUrl?: string | null;
  isRevealed?: boolean;
  className?: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
  fullWidth?: boolean;
  onClick?: ComponentProps<typeof Button>["onClick"];
};

export function OpenLinkedInButton({
  candidateId,
  searchCandidateId,
  linkedinUrl,
  isRevealed,
  className,
  size = "sm",
  variant,
  fullWidth = true,
  onClick,
}: OpenLinkedInButtonProps) {
  const { openLinkedIn, isLoading } = useOpenLinkedInWithCredits();
  const [revealed, setRevealed] = useState(Boolean(isRevealed));

  useEffect(() => {
    setRevealed(Boolean(isRevealed));
  }, [isRevealed]);

  if (!linkedinUrl) return null;

  const resolvedVariant = variant ?? (revealed ? "outline" : "default");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={size}
            variant={resolvedVariant}
            type="button"
            className={cn("font-medium", fullWidth && "w-full", className)}
            onClick={async (event) => {
              onClick?.(event);
              const result = await openLinkedIn({
                candidateId,
                searchCandidateId,
                linkedinUrl,
              });
              if (result?.success) {
                setRevealed(true);
              }
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : revealed ? (
              <IconExternalLink className="h-4 w-4" />
            ) : (
              <IconExternalLink className="h-4 w-4" />
            )}
            <span>Open LinkedIn</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isLoading ? "Opening LinkedIn..." : revealed ? "Already revealed (free)" : "1 credit"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
