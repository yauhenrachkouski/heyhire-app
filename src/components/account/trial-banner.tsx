"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/icon"
import { startProBillingNow } from "@/actions/stripe"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
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
import { Badge } from "@/components/ui/badge"
import { PaymentMethodBlock } from "@/components/account/payment-method-block"

interface TrialBannerProps {
  trialEndLabel: string | null
  nextBillingLabel: string | null
  nextBillingAmountLabel: string | null
}

export function TrialBanner({
  trialEndLabel,
  nextBillingLabel,
  nextBillingAmountLabel,
}: TrialBannerProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleUnlockNow = () => {
    startTransition(async () => {
      try {
        const result = await startProBillingNow()

        if (result.success) {
          toast.success("Successfully upgraded to Pro! Your billing cycle has started.")
          setIsConfirmOpen(false)
          router.refresh()
        } else {
          toast.error(result.error || "Failed to upgrade trial")
        }
      } catch (error) {
        console.error("Error upgrading trial:", error)
        toast.error("Failed to upgrade trial. Please try again.")
      }
    })
  }

  return (
    <>
      <div className="rounded-lg border p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Icon name="sparkles" className="h-4 w-4 text-muted-foreground" />
            <span>Trial</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {trialEndLabel ? (
              <>
                Your trial ends on {trialEndLabel}.{' '}
                {nextBillingLabel
                  ? `Next billing will charge you${nextBillingAmountLabel ? ` ${nextBillingAmountLabel}` : ''} on ${nextBillingLabel}.`
                  : `Next billing will charge you${nextBillingAmountLabel ? ` ${nextBillingAmountLabel}` : ''} when your trial ends.`}
              </>
            ) : (
              <>
                Your trial is active.{' '}
                {nextBillingLabel
                  ? `Next billing will charge you${nextBillingAmountLabel ? ` ${nextBillingAmountLabel}` : ''} on ${nextBillingLabel}.`
                  : `Next billing will charge you${nextBillingAmountLabel ? ` ${nextBillingAmountLabel}` : ''} when your trial ends.`}
              </>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button size="sm" onClick={() => setIsConfirmOpen(true)} disabled={isPending}>
              Unlock full Pro now
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Pro billing now?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>You'll be charged {nextBillingAmountLabel || '$69'} today.</p>
                <p>Your trial will end immediately.</p>
                <p>You'll get 1,000 reveals available right away.</p>
                {nextBillingLabel && (
                  <p>Next billing date: {nextBillingLabel}.</p>
                )}

                <div className="pt-2">
                  <PaymentMethodBlock />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlockNow} disabled={isPending}>
              {isPending ? "Processing..." : `Pay ${nextBillingAmountLabel || '$69'} & unlock now`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
