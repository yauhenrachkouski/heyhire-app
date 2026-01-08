"use client"

import { log } from "@/lib/axiom/client";

const source = "components/account/unlock-pro-now-button";

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { startProBillingNow } from "@/actions/stripe"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useActiveOrganization } from "@/lib/auth-client"
import { creditsKeys } from "@/lib/credits"
import { subscriptionKeys } from "@/hooks/use-subscription"
import { PLAN_LIMITS } from "@/types/plans"
import type { PlanId } from "@/types/plans"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface UnlockProNowButtonProps {
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
  className?: string
  children: React.ReactNode
  nextBillingAmountLabel?: string | null
  nextBillingLabel?: string | null
  planId?: PlanId
  onSuccess?: () => void
}

export function UnlockProNowButton({
  variant = "outline",
  size = "sm",
  className,
  children,
  nextBillingAmountLabel,
  nextBillingLabel,
  planId = "pro",
  onSuccess,
}: UnlockProNowButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: activeOrg } = useActiveOrganization()

  const handleUnlockNow = () => {
    startTransition(async () => {
      try {
        const result = await startProBillingNow()

        if (result.success) {
          toast.success("Successfully upgraded to Pro! Your billing cycle has started.")
          setIsConfirmOpen(false)

          // Invalidate subscription and credits queries to refresh UI
          if (activeOrg?.id) {
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: subscriptionKeys.organization(activeOrg.id) }),
              queryClient.invalidateQueries({ queryKey: creditsKeys.organization(activeOrg.id) }),
            ])
          }
          // Also invalidate at the root level
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: subscriptionKeys.all }),
            queryClient.invalidateQueries({ queryKey: creditsKeys.all }),
          ])

          router.refresh()
          onSuccess?.()
        } else {
          toast.error(result.error || "Failed to upgrade trial")
        }
      } catch (error) {
        log.error("upgrade_trial.error", { source, error: error instanceof Error ? error.message : String(error) })
        toast.error("Failed to upgrade trial. Please try again.")
      }
    })
  }

  const credits = PLAN_LIMITS[planId].credits

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setIsConfirmOpen(true)}
        disabled={isPending}
      >
        {children}
      </Button>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start full Pro Plan now</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p>
                You'll be charged {nextBillingAmountLabel || '$99'} today. You'll get {credits}{" "}
                reveals available right away.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlockNow} disabled={isPending}>
              {isPending ? "Processing..." : `Pay ${nextBillingAmountLabel || '$99'} & unlock now`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
