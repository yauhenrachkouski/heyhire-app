"use client"

import { subscription as subscriptionSchema } from "@/db/schema"
import { CurrentSubscriptionRow } from "@/components/account/current-subscription-row"

interface BillingSectionProps {
  subscription: typeof subscriptionSchema.$inferSelect | null;
}

export function BillingSection({ subscription: initialSubscription }: BillingSectionProps) {
  return <CurrentSubscriptionRow subscription={initialSubscription} />;
}

