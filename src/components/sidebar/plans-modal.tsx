"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { SubscribeCardsServer, SubscribeHeader } from "@/components/subscribe/subscribe-cards";

interface PlansModalProps {
  children: React.ReactNode;
  currentPlan?: "starter" | "pro" | null;
  isTrialEligible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PlansModal({ children, currentPlan, isTrialEligible, open, onOpenChange }: PlansModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:!max-w-[95vw] md:!max-w-[1400px] max-h-[90vh] overflow-y-auto gap-0">
        <DialogTitle className="sr-only">Pricing</DialogTitle>
        <div className="pt-6 sm:pt-8">
          <SubscribeHeader isRequired={false} isTrialEligible={isTrialEligible} />
        </div>
        <SubscribeCardsServer isRequired={false} isTrialEligible={isTrialEligible} showSupportSections />
      </DialogContent>
    </Dialog>
  );
}




