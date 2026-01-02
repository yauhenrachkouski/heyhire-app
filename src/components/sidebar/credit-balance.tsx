"use client";

import * as React from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Icon } from "@/components/icon";
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

  const prevCreditsRef = React.useRef<number | null>(null);
  const pendingSpendAnimationRef = React.useRef(false);
  
  const iconRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);

  const { contextSafe } = useGSAP();

  const triggerSpendAnimation = contextSafe(() => {
    if (!iconRef.current || !textRef.current) return;

    // Reset state first
    gsap.killTweensOf([iconRef.current, textRef.current]);
    gsap.set([iconRef.current, textRef.current], { clearProps: "all" });

    const tl = gsap.timeline();

    // Icon animation: Pop scale + Shake
    tl.to(iconRef.current, { 
      scale: 1.3, 
      duration: 0.15, 
      ease: "back.out(1.7)" 
    })
    .to(iconRef.current, { 
      rotation: 15, 
      duration: 0.05 
    })
    .to(iconRef.current, { 
      rotation: -15, 
      duration: 0.05 
    })
    .to(iconRef.current, { 
      rotation: 10, 
      duration: 0.05 
    })
    .to(iconRef.current, { 
      rotation: -10, 
      duration: 0.05 
    })
    .to(iconRef.current, { 
      scale: 1, 
      rotation: 0, 
      duration: 0.2, 
      ease: "elastic.out(1, 0.3)" 
    });

    // Text animation: Shake
    gsap.fromTo(textRef.current,
      { x: 0 },
      { 
        x: -2, 
        duration: 0.05, 
        repeat: 5, 
        yoyo: true, 
        ease: "sine.inOut",
        onComplete: () => { gsap.set(textRef.current, { x: 0 }); }
      }
    );

    // Color flash (Red)
    gsap.to([iconRef.current, textRef.current], {
      color: "#ef4444", 
      duration: 0.15,
      yoyo: true,
      repeat: 1,
      ease: "power2.inOut",
      onComplete: () => { gsap.set([iconRef.current, textRef.current], { clearProps: "color" }); }
    });
  });

  React.useEffect(() => {
    const prevCredits = prevCreditsRef.current;
    prevCreditsRef.current = credits;

    if (prevCredits === null) return;
    if (credits === -1 || prevCredits === -1) return;

    // If a spend happens while the tab is hidden, defer the animation until the user returns.
    if (credits < prevCredits) {
      if (typeof document !== "undefined" && document.hidden) {
        pendingSpendAnimationRef.current = true;
        return;
      }

      triggerSpendAnimation();
    }
  }, [credits, triggerSpendAnimation]);

  React.useEffect(() => {
    const maybePlayPendingAnimation = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) return;
      if (!pendingSpendAnimationRef.current) return;

      pendingSpendAnimationRef.current = false;
      triggerSpendAnimation();
    };

    document.addEventListener("visibilitychange", maybePlayPendingAnimation);
    window.addEventListener("focus", maybePlayPendingAnimation);

    return () => {
      document.removeEventListener("visibilitychange", maybePlayPendingAnimation);
      window.removeEventListener("focus", maybePlayPendingAnimation);
    };
  }, [triggerSpendAnimation]);
  
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
            <div ref={iconRef} className="flex items-center justify-center">
              <Icon 
                name="coins" 
                className={isOutOfCredits ? "text-destructive" : ""}
              />
            </div>
            <span
              ref={textRef}
              className={`truncate transition-colors ${isOutOfCredits ? "text-destructive" : ""}`}
            >
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


