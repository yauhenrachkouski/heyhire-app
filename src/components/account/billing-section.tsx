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
    <div className="space-y-6">
      {/* Current Subscription Card */}
      <Card>
        
        <CardContent className="space-y-6">
          {!subscription ? (
            <Alert>
              <Icon name="sparkles" className="h-4 w-4" />
              <AlertDescription>
                You don't have an active subscription. Choose a plan below to get started.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Current Plan Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current Plan</p>
                    <p className="text-2xl font-bold capitalize">{subscription.plan}</p>
                  </div>
                  {getStatusBadge()}
                </div>

                {/* Subscription Details */}
                <div className="grid gap-4 md:grid-cols-3">
                  {subscription.periodEnd && (
                    <div className="flex items-start gap-3">
                      <Icon name="calendar" className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">
                          {subscription.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(subscription.periodEnd)}
                        </p>
                      </div>
                    </div>
                  )}

                  {currentPlanData && !currentPlanData.isCustom && (
                    <div className="flex items-start gap-3">
                      <Icon name="credit-card" className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Billing Amount</p>
                        <p className="text-sm text-muted-foreground">
                          ${currentPlanData.price}/month
                        </p>
                      </div>
                    </div>
                  )}

                  {subscription.seats && (
                    <div className="flex items-start gap-3">
                      <Icon name="users" className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">Seats</p>
                        <p className="text-sm text-muted-foreground">
                          {subscription.seats} {subscription.seats === 1 ? 'seat' : 'seats'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Warning for canceling subscription */}
                {subscription.cancelAtPeriodEnd && (
                  <Alert variant="destructive">
                    <Icon name="alert-triangle" className="h-4 w-4" />
                    <AlertDescription>
                      Your subscription will be canceled on {formatDate(subscription.periodEnd)}. 
                      You'll lose access to premium features after this date.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                <Button
                    onClick={handleManageBilling}
                    disabled={isLoading}
                    variant="outline"
                  >
                    <Icon name="credit-card" className="h-4 w-4" />
                    Manage Payment Method
                  </Button>

                  <Button
                    onClick={handleManageBilling}
                    disabled={isLoading}
                    variant="outline"
                  >
                    <Icon name="file-text" className="h-4 w-4" />
                    View Invoices
                  </Button>
                  {subscription && (
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <Icon name="refresh-cw" className="h-4 w-4" />
                          Change Plan
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="w-[95vw] sm:!max-w-[95vw] md:!max-w-[1400px] max-h-[90vh] overflow-y-auto">
                        <div className="text-center my-8">
                          <h2 className="text-4xl font-bold mb-4">
                            Change Your Plan
                          </h2>
                          <p className="text-lg text-muted-foreground">
                            Upgrade or downgrade your subscription at any time
                          </p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-8">
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
                  )}
                  {subscription.cancelAtPeriodEnd ? (
                    <Button
                      onClick={handleResume}
                      disabled={isLoading}
                      variant="default"
                    >
                      <Icon name="refresh-cw" className="h-4 w-4" />
                      Resume Subscription
                    </Button>
                  ) : (
                    <Button
                      onClick={handleCancel}
                      disabled={isLoading}
                      className="bg-background border border-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60"
                    >
                      <Icon name="x" className="h-4 w-4" />
                      Cancel Subscription
                    </Button>
                  )}

                

                  

                  
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

