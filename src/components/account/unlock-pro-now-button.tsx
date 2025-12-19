"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
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
import { PaymentMethodBlock } from "@/components/account/payment-method-block"

interface UnlockProNowButtonProps {
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
  className?: string
  children: React.ReactNode
  nextBillingAmountLabel?: string | null
  nextBillingLabel?: string | null
}

export function UnlockProNowButton({
  variant = "outline",
  size = "sm",
  className,
  children,
  nextBillingAmountLabel,
  nextBillingLabel,
}: UnlockProNowButtonProps) {
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
