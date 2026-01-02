"use client"

import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { subscription as subscriptionSchema } from "@/db/schema"
import type { PlanId } from "@/types/plans"
import { isPlanId } from "@/types/plans"
import { PLAN_LIMITS } from "@/types/plans"
import { useActiveOrganization } from "@/lib/auth-client"
import { useQuery } from "@tanstack/react-query"
import { getCreditsUsageForPeriod } from "@/actions/credits"
import { creditsKeys } from "@/lib/credits"

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
  nextBillingLabel?: string | null;
  nextBillingAmountLabel?: string | null;
  initialPeriodUsed?: number;
  currentBalance?: number;
}

export function CurrentSubscriptionRow({ 
  subscription, 
  nextBillingLabel, 
  nextBillingAmountLabel,
  initialPeriodUsed,
  currentBalance
}: CurrentSubscriptionRowProps) {
  const { data: activeOrg } = useActiveOrganization();

  const orgId = activeOrg?.id;
  const start = subscription?.periodStart;
  const end = subscription?.periodEnd;

  const shouldUseUsageQuery = currentBalance === undefined || currentBalance === null;
  const { data: periodUsageData } = useQuery({
    queryKey: creditsKeys.usage(orgId ?? "", start ?? null, end ?? null),
    queryFn: async () => {
      if (!orgId || !start || !end) {
        return { used: null, error: null };
      }

      const result = await getCreditsUsageForPeriod({
        organizationId: orgId,
        startDate: new Date(start),
        endDate: new Date(end),
      });

      return { used: result.error ? null : result.used, error: result.error };
    },
    enabled: shouldUseUsageQuery && !!orgId && !!start && !!end,
    initialData: shouldUseUsageQuery && initialPeriodUsed !== undefined ? { used: initialPeriodUsed, error: null } : undefined,
    placeholderData: (previousData) => previousData,
    staleTime: 0,
    gcTime: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const periodUsed = periodUsageData?.used ?? null;
  const periodUsageError = periodUsageData?.error ?? null;

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

  const currentPlan: PlanId | null = isPlanId(subscription?.plan) ? subscription.plan : null
  const currentPlanData = plans.find((p) => p.planId === currentPlan);

  const isTrialing = subscription?.status === "trialing";
  const allocation = currentPlan ? (isTrialing ? PLAN_LIMITS[currentPlan].trialCredits : PLAN_LIMITS[currentPlan].credits) : null;
  const used = currentBalance !== undefined && currentBalance !== null && allocation !== null
    ? Math.max(allocation - currentBalance, 0)
    : (periodUsed ?? 0);
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
