'use client'

import { log } from "@/lib/axiom/client-log";

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

            const resultAny: any = result as any
            const errorMessage =
              resultAny?.error?.message ??
              resultAny?.error ??
              resultAny?.data?.error?.message ??
              resultAny?.data?.error

            if (errorMessage) {
              log.error("SubscribeCheckoutButton", "subscription.upgrade error", { result: resultAny })
              toast.error(String(errorMessage))
              return
            }

            const session: any = resultAny?.data ?? resultAny

            if (!session?.url) {
              log.error("SubscribeCheckoutButton", "subscription.upgrade missing url", { result: resultAny })
              toast.error("Failed to start checkout. Please try again.")
              return
            }

            window.location.href = session.url
          } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to start checkout"

            log.error("SubscribeCheckoutButton", "subscription.upgrade threw", { error: e })

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
