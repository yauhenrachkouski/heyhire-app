"use client"

import { Icon } from "@/components/icon"
import { UnlockProNowButton } from "@/components/account/unlock-pro-now-button"

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
            <UnlockProNowButton
              size="sm"
              nextBillingAmountLabel={nextBillingAmountLabel}
              nextBillingLabel={nextBillingLabel}
            >
              Unlock full Pro now
            </UnlockProNowButton>
          </div>
        </div>
      </div>
    </>
  )
}
