"use client";

import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Icon } from "@/components/ui/icon";
import { PlansModal } from "@/components/sidebar/plans-modal";
import { formatCreditBalance } from "@/lib/credits";
import { usePlansModal } from "@/providers/plans-modal-provider";
import type { PlanId } from "@/types/plans";

interface CreditBalanceProps {
  credits: number;
  maxCredits?: number;
  currentPlan?: PlanId | null;
  isTrialEligible?: boolean;
  trialWarning?: { used: number; limit: number } | null;
}

export function CreditBalance({ credits, maxCredits, currentPlan, isTrialEligible, trialWarning }: CreditBalanceProps) {

  const isUnlimited = credits === -1;
  const isOutOfCredits = credits === 0 && !isUnlimited;
  
  const displayText = isUnlimited 
    ? "∞ credits"
    : maxCredits 
    ? `${formatCreditBalance(credits)}/${formatCreditBalance(maxCredits)} credits`
    : `${formatCreditBalance(credits)} credits`;

  const tooltipContent = (
    <div className="text-sm">
      <p className="font-medium mb-1">{displayText}</p>
      <p className="opacity-70">Email = 1 credit</p>
      {trialWarning && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-orange-600 font-medium">Trial Warning</p>
          <p className="text-xs">You've used {trialWarning.used}/{trialWarning.limit} trial reveals</p>
        </div>
      )}
    </div>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <PlansModal currentPlan={currentPlan} isTrialEligible={isTrialEligible}>
          <SidebarMenuButton 
            tooltip={{ children: tooltipContent, side: "right" }}
            className="border border-border h-10"
          >
            <Icon 
              name="coins" 
              className={isOutOfCredits ? "text-destructive" : ""}
            />
            <span className={`truncate ${isOutOfCredits ? "text-destructive" : ""}`}>
              {displayText}
            </span>
            <span className={`text-xs font-medium whitespace-nowrap ml-auto ${isOutOfCredits ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              Upgrade
            </span>
          </SidebarMenuButton>
        </PlansModal>
      </SidebarMenuItem>

    </SidebarMenu>
  );
}


