"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SubscribeCardsServer, SubscribeHeader } from "@/components/subscribe/subscribe-cards";
import type { PlanId } from "@/types/plans";

interface PlansModalProps {
  children: React.ReactNode;
  currentPlan?: PlanId | null;
  isTrialEligible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PlansModal({ children, currentPlan, isTrialEligible, open, onOpenChange }: PlansModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = open !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

  const trialEligible = isTrialEligible ?? !currentPlan;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-[95vw]! md:max-w-[1400px]! max-h-[90vh] overflow-y-auto gap-0">
        <DialogTitle className="sr-only">Pricing</DialogTitle>
        <DialogDescription className="sr-only">
          Choose a plan and proceed to checkout.
        </DialogDescription>
        <div className="pt-6 sm:pt-8">
          <SubscribeHeader isRequired={false} isTrialEligible={trialEligible} currentPlan={currentPlan} />
        </div>
        <SubscribeCardsServer
          isRequired={false}
          isTrialEligible={trialEligible}
          showSupportSections
          currentPlan={currentPlan}
        />
      </DialogContent>
    </Dialog>
  );
}




