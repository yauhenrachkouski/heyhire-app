"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Icon } from "@/components/ui/icon"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cancelSubscription, resumeSubscription, getCustomerPortalSession } from "@/actions/stripe"
import { toast } from "sonner"
import { subscription as subscriptionSchema } from "@/db/schema"
import type { PlanId } from "@/types/plans"

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

interface BillingSectionProps {
  subscription: typeof subscriptionSchema.$inferSelect | null;
}

export function BillingSection({ subscription: initialSubscription }: BillingSectionProps) {
  const [subscription, setSubscription] = useState(initialSubscription);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      const result = await cancelSubscription();
      if (result.success) {
        toast.success("Subscription Canceled", {
          description: result.message,
        });
        setSubscription(prev => prev ? { ...prev, cancelAtPeriodEnd: true } : null);
      } else {
        toast.error("Failed to Cancel", {
          description: result.error || "Only organization owners/admins can manage billing",
        });
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      const result = await resumeSubscription();
      if (result.success) {
        toast.success("Subscription Resumed", {
          description: result.message,
        });
        setSubscription(prev => prev ? { ...prev, cancelAtPeriodEnd: false } : null);
      } else {
        toast.error("Failed to Resume", {
          description: result.error || "Only organization owners/admins can manage billing",
        });
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      const result = await getCustomerPortalSession();
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast.error("Failed to Open Portal", {
          description: result.error || "Only organization owners/admins can manage billing",
        });
        setIsLoading(false);
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred",
      });
      setIsLoading(false);
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

  const currentPlan = (subscription?.plan as PlanId | null) || null;
  const currentPlanData = plans.find(p => p.planId === currentPlan);

  return (
    <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          <CardDescription>Manage your organization's billing and subscription settings</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {!subscription ? (
            <Alert>
              <AlertDescription>
                You don't have an active subscription. Choose a plan below to get started.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Current Plan Card */}
              <div className="rounded-lg border p-4 w-fit">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
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

              {/* Billing Information */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold">Billing Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {subscription.periodEnd && (
                    <div className="rounded-lg border p-4">
                      <p className="text-sm text-muted-foreground mb-1">
                        {subscription.cancelAtPeriodEnd ? "Cancels on" : "Next billing date"}
                      </p>
                      <p className="font-medium">{formatDate(subscription.periodEnd)}</p>
                    </div>
                  )}
                 
                </div>
              </div>

              {/* Warning for canceling subscription */}
              {subscription.cancelAtPeriodEnd && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Your subscription will be canceled on {formatDate(subscription.periodEnd)}. 
                    You'll lose access to premium features after this date.
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                  <DialogTrigger asChild>
                    <Button disabled={isLoading}>
                      Manage Billing
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] sm:max-w-[95vw]! md:max-w-[1400px]! max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <div className="text-center my-4 sm:my-8">
                      <DialogTitle className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-4">
                        Manage Billing
                      </DialogTitle>
                      <p className="text-sm sm:text-lg text-muted-foreground">
                        Update payment method, view invoices, or cancel your subscription
                      </p>
                    </div>
                    <div className="max-w-2xl mx-auto mb-4 sm:mb-8">
                      <Button
                        className="w-full"
                        size="lg"
                        disabled={isLoading}
                        onClick={handleManageBilling}
                      >
                        Open Stripe Customer Portal
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {subscription.cancelAtPeriodEnd ? (
                  <Button
                    onClick={handleResume}
                    disabled={isLoading}
                    variant="default"
                  >
                    Resume Subscription
                  </Button>
                ) : (
                  <Button
                    onClick={handleCancel}
                    disabled={isLoading}
                    variant="outline"
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
  );
}

