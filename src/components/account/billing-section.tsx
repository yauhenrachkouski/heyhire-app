"use client"

import { subscription as subscriptionSchema } from "@/db/schema"
import { CurrentSubscriptionRow } from "@/components/account/current-subscription-row"

interface BillingSectionProps {
  subscription: typeof subscriptionSchema.$inferSelect | null;
  nextBillingLabel?: string | null;
  nextBillingAmountLabel?: string | null;
  initialPeriodUsed?: number;
  currentBalance?: number;
}

export function BillingSection({ 
  subscription, 
  nextBillingLabel, 
  nextBillingAmountLabel,
  initialPeriodUsed,
  currentBalance
}: BillingSectionProps) {
  return <CurrentSubscriptionRow
    subscription={subscription}
    nextBillingLabel={nextBillingLabel}
    nextBillingAmountLabel={nextBillingAmountLabel}
    initialPeriodUsed={initialPeriodUsed}
    currentBalance={currentBalance}
  />;
}
