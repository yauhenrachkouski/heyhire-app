'use client'

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { subscription, useActiveOrganization } from "@/lib/auth-client"
import { getActiveOrgId } from "@/lib/auth-helpers"
import { toast } from "sonner"
import type { PlanId } from "@/types/plans"

interface SubscribeCheckoutButtonProps {
  plan: PlanId
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
  const { data: activeOrg } = useActiveOrganization()
  const router = useRouter()

  return (
    <Button
      type="button"
      className={className}
      size="lg"
      variant={variant}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          let referenceId = activeOrg?.id

          if (!referenceId) {
            try {
              referenceId = await getActiveOrgId()
            } catch (e) {
              const message = e instanceof Error ? e.message : "Failed to get organization"

              if (message.includes("Not authenticated")) {
                router.push("/auth/signin")
                router.refresh()
                return
              }

              toast.error("Please finish onboarding to select a plan")
              router.push("/onboarding")
              router.refresh()
              return
            }
          }

          if (!referenceId) {
            toast.error("Please finish onboarding to select a plan")
            router.push("/onboarding")
            router.refresh()
            return
          }

          const origin = window.location.origin

          try {
            const result = await subscription.upgrade({
              plan,
              referenceId,
              successUrl: `${origin}/paywall/success`,
              cancelUrl: `${origin}/paywall`,
            })

            const session: any = (result as any)?.data ?? result

            if (!session?.url) {
              toast.error("Failed to start checkout. Please try again.")
              return
            }

            window.location.href = session.url
          } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to start checkout"

            if (message.includes("Not authenticated")) {
              router.push("/auth/signin")
              router.refresh()
              return
            }

            if (
              message.includes("No active organization") ||
              message.toLowerCase().includes("organization")
            ) {
              toast.error("Please finish onboarding to select a plan")
              router.push("/onboarding")
              router.refresh()
              return
            }

            if (
              message.toLowerCase().includes("not authorized") ||
              message.toLowerCase().includes("unauthorized") ||
              message.toLowerCase().includes("forbidden")
            ) {
              toast.error("Only organization owners/admins can manage billing")
              return
            }

            toast.error("Failed to start checkout. Please try again.")
          }
        })
      }}
    >
      {children}
    </Button>
  )
}
