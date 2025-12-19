"use client"

import { Button } from "@/components/ui/button"
import { UnlockProNowButton } from "@/components/account/unlock-pro-now-button"

interface PricingUnlockButtonProps {
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
  className?: string
  children: React.ReactNode
}

export function PricingUnlockButton({ variant = "default", size = "lg", className, children }: PricingUnlockButtonProps) {
  return (
    <UnlockProNowButton variant={variant} size={size} className={className}>
      {children}
    </UnlockProNowButton>
  )
}
