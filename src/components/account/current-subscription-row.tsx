"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { subscription as subscriptionSchema } from "@/db/schema"
import type { PlanId } from "@/types/plans"
import { PLAN_LIMITS } from "@/types/plans"
import { useActiveOrganization } from "@/lib/auth-client"
import { useEffect } from "react"
import { getCreditsUsageForPeriod } from "@/actions/credits"

interface PricingPlan {
  name: string;
  price: number;
  description: string;
  features: string[];
  planId: PlanId;
}

const plans: PricingPlan[] = [
  {
    name: "Pro",
    price: 69,
    planId: "pro",
    description: "3-day free trial to try, 100 reveals included",
    features: [
      "Search candidates",
      "1,000 reveals included",
      "Exports",
      "Support",
    ],
  },
];

interface CurrentSubscriptionRowProps {
  subscription: typeof subscriptionSchema.$inferSelect | null;
}

export function CurrentSubscriptionRow({ subscription: initialSubscription }: CurrentSubscriptionRowProps) {
  const [subscription, setSubscription] = useState(initialSubscription);
  const [isLoading, setIsLoading] = useState(false);
  const { data: activeOrg } = useActiveOrganization();
  const [periodUsed, setPeriodUsed] = useState<number | null>(null);
  const [periodUsageError, setPeriodUsageError] = useState<string | null>(null);

  useEffect(() => {
    setSubscription(initialSubscription);
  }, [initialSubscription]);

  const getStatusBadge = () => {
    if (!subscription) {
      return <Badge variant="secondary">No Subscription</Badge>;
    }

    if (subscription.cancelAtPeriodEnd) {
      return <Badge variant="destructive">Canceling</Badge>;
    }

    switch (subscription.status) {
      case "active":
        return <Badge variant="default" className="bg-green-600">Active</Badge>;
      case "trialing":
        return <Badge variant="default" className="bg-blue-600">Trial</Badge>;
      case "past_due":
        return <Badge variant="destructive" className="bg-yellow-600">Past Due</Badge>;
      case "canceled":
        return <Badge variant="destructive">Canceled</Badge>;
      default:
        return <Badge variant="secondary">{subscription.status}</Badge>;
    }
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  useEffect(() => {
    const orgId = activeOrg?.id;
    const start = subscription?.periodStart;
    const end = subscription?.periodEnd;
    if (!orgId || !start || !end) {
      setPeriodUsed(null);
      setPeriodUsageError(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      const res = await getCreditsUsageForPeriod({
        organizationId: orgId,
        startDate: new Date(start),
        endDate: new Date(end),
        creditType: "contact_lookup",
      });
      if (cancelled) return;
      setPeriodUsed(res.error ? null : res.used);
      setPeriodUsageError(res.error);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeOrg?.id, subscription?.periodStart, subscription?.periodEnd]);

  const currentPlan = (subscription?.plan as PlanId | null) || null;
  const currentPlanData = plans.find((p) => p.planId === currentPlan);

  const isTrialing = subscription?.status === "trialing";
  const allocation = currentPlan ? (isTrialing ? PLAN_LIMITS[currentPlan].trialCredits : PLAN_LIMITS[currentPlan].credits) : null;
  const used = periodUsed ?? 0;
  const progressValue = allocation && allocation > 0 ? Math.min(100, Math.round((used / allocation) * 100)) : 0;
  const periodLabel = subscription?.periodStart && subscription?.periodEnd
    ? `${formatDate(subscription.periodStart)} – ${formatDate(subscription.periodEnd)}`
    : null;

  return (
    <div className="rounded-lg border p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1">
          <div className="text-base font-semibold">Current Subscription</div>
          <div className="text-sm text-muted-foreground">
            Manage your organization's billing and subscription settings
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {!subscription ? (
          <Alert>
            <AlertDescription>
              You don't have an active subscription. Choose a plan below to get started.
            </AlertDescription>
          </Alert>
        ) : (
          <>
          <div className="flex flex-col gap-1 sm:gap-2">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <p className="text-lg sm:text-xl font-bold capitalize">{subscription.plan} Plan</p>
              {currentPlanData && (
                <Badge variant="secondary" className="font-medium">
                  ${currentPlanData.price}/month
                </Badge>
              )}
              {getStatusBadge()}
            </div>

            {currentPlanData && (
              <p className="text-sm text-muted-foreground">{currentPlanData.description}</p>
            )}
          </div>

            {allocation && periodLabel && (
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">Usage</div>
                  <div className="text-xs text-muted-foreground">{periodLabel}</div>
                </div>
                <Progress value={progressValue} />
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    {periodUsageError ? "Unable to load usage" : `${used.toLocaleString()} used`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {allocation.toLocaleString()} included
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="text-base font-semibold">Billing Information</div>
              {subscription.periodEnd && (
                <p className="text-sm">
                  {subscription.cancelAtPeriodEnd ? "Cancels on" : "Next billing date"}: <span className="font-medium">{formatDate(subscription.periodEnd)}</span>
                </p>
              )}
            </div>

            {subscription.cancelAtPeriodEnd && (
              <Alert variant="destructive">
                <AlertDescription>
                  Your subscription will be canceled on {formatDate(subscription.periodEnd)}.
                  You'll lose access to premium features after this date.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </div>
    </div>
  );
}
