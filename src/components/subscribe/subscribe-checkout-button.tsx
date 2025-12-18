'use client'

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { subscription, useActiveOrganization } from "@/lib/auth-client"

interface SubscribeCheckoutButtonProps {
  plan: "starter" | "pro"
  variant?: "default" | "outline"
  className?: string
  children: React.ReactNode
}

export function SubscribeCheckoutButton({
  plan,
  variant = "default",
  className,
  children,
}: SubscribeCheckoutButtonProps) {
  const [isPending, startTransition] = useTransition()
  const activeOrg = useActiveOrganization()

  return (
    <Button
      type="button"
      className={className}
      size="lg"
      variant={variant}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const referenceId = activeOrg.data?.id

          if (!referenceId) {
            throw new Error("No active organization")
          }

          const origin = window.location.origin

          const result = await subscription.upgrade({
            plan,
            referenceId,
            successUrl: `${origin}/paywall/success`,
            cancelUrl: `${origin}/paywall`,
          })

          const session: any = (result as any)?.data ?? result

          if (!session?.url) {
            throw new Error("Failed to get checkout URL")
          }

          window.location.href = session.url
        })
      }}
    >
      {children}
    </Button>
  )
}
