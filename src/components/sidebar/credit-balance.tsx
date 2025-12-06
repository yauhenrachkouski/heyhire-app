"use client";

import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Icon } from "@/components/ui/icon";
import { PlansModal } from "@/components/sidebar/plans-modal";
import { formatCreditBalance } from "@/lib/credits";

interface CreditBalanceProps {
  credits: number;
  maxCredits?: number;
  currentPlan?: "starter" | "pro" | "enterprise" | null;
}

export function CreditBalance({ credits, maxCredits, currentPlan }: CreditBalanceProps) {
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
    </div>
  );
  
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <PlansModal currentPlan={currentPlan}>
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


