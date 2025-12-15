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
import { Check } from "lucide-react"

interface PricingPlan {
  name: string;
  price: number;
  description: string;
  features: string[];
  planId: "starter" | "pro" | "enterprise";
  isCustom?: boolean;
}

const plans: PricingPlan[] = [
  {
    name: "Starter",
    price: 99,
    planId: "starter",
    description: "Perfect for solo recruiters",
    features: [
      "100 searches per month",
      "1,000 candidate profiles",
      "Email support",
      "Basic analytics",
      "Export to CSV",
    ],
  },
  {
    name: "Pro",
    price: 199,
    planId: "pro",
    description: "Perfect for small teams",
    features: [
      "500 searches per month",
      "5,000 candidate profiles",
      "Priority email support",
      "Advanced analytics & insights",
      "API access",
      "Custom integrations",
      "Team collaboration tools",
    ],
  },
  {
    name: "Enterprise",
    price: 0,
    planId: "enterprise",
    description: "Custom solutions for large organizations",
    isCustom: true,
    features: [
      "Unlimited searches",
      "Unlimited candidates",
      "Dedicated account manager",
      "24/7 priority support",
      "Custom integrations",
      "SLA guarantee",
      "Advanced security features",
      "Custom training & onboarding",
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
          description: result.error,
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
          description: result.error,
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
          description: result.error,
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

  const currentPlan = subscription?.plan || null;
  const currentPlanData = plans.find(p => p.planId === currentPlan);

  return (
    <Card>
        <CardHeader>
          <CardTitle>Current Subscription</CardTitle>
          <CardDescription>Manage your billing and subscription settings</CardDescription>
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
              <div className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                  <p className="text-lg sm:text-xl font-bold capitalize">{subscription.plan} Plan</p>
                  {currentPlanData && !currentPlanData.isCustom && (
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
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground mb-1">Payment method</p>
                    <p className="font-medium">Credit Card</p>
                  </div>
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
                      Update Plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] sm:!max-w-[95vw] md:!max-w-[1400px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
                    <div className="text-center my-4 sm:my-8">
                      <DialogTitle className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-4">
                        Change Your Plan
                      </DialogTitle>
                      <p className="text-sm sm:text-lg text-muted-foreground">
                        Upgrade or downgrade your subscription at any time
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 max-w-6xl mx-auto mb-4 sm:mb-8">
                      {plans.map((plan) => {
                        const isCurrentPlan = currentPlan === plan.planId;
                        
                        return (
                          <Card
                            key={plan.planId}
                            className={`relative flex flex-col ${
                              isCurrentPlan ? "border-primary shadow-lg scale-105" : ""
                            }`}
                          >
                            {isCurrentPlan && (
                              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                                Current Plan
                              </Badge>
                            )}

                            <CardHeader>
                              <CardTitle className="text-2xl">{plan.name}</CardTitle>
                              <CardDescription>{plan.description}</CardDescription>
                            </CardHeader>

                            <CardContent className="flex-1">
                              <div className="mb-6">
                                {plan.isCustom ? (
                                  <div className="text-4xl font-bold">Custom</div>
                                ) : (
                                  <div className="text-4xl font-bold">
                                    ${plan.price}
                                    <span className="text-lg font-normal text-muted-foreground">
                                      /month
                                    </span>
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground mt-3">
                                  Switch or cancel at any time
                                </p>
                              </div>

                              <ul className="space-y-3">
                                {plan.features.map((feature, index) => (
                                  <li key={index} className="flex items-start gap-2">
                                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                    <span className="text-sm">{feature}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>

                            <CardFooter>
                              <Button
                                className="w-full"
                                size="lg"
                                variant={isCurrentPlan ? "secondary" : "default"}
                                disabled={isCurrentPlan || isLoading}
                                onClick={() => {
                                  if (plan.isCustom) {
                                    const subject = encodeURIComponent("Enterprise Plan Inquiry");
                                    const body = encodeURIComponent("Hi,\n\nI'm interested in learning more about the Enterprise plan for HeyHire.\n\nCould you please provide more information about:\n- Custom pricing\n- Available features\n- Implementation timeline\n\nThank you!");
                                    window.location.href = `mailto:support@heyhire.ai?subject=${subject}&body=${body}`;
                                  } else {
                                    handleManageBilling();
                                  }
                                }}
                              >
                                {isCurrentPlan ? "Current Plan" : plan.isCustom ? "Contact Sales" : "Change Plan"}
                              </Button>
                            </CardFooter>
                          </Card>
                        );
                      })}
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

