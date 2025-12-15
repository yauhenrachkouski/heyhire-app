"use client";

import { subscription } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { AvatarStack } from "./avatar-stack";
import { useSession } from "@/lib/auth-client";

interface PricingPlan {
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  planId: "starter" | "pro" | "enterprise";
  ctaText: string;
  ctaTextNoTrial: string;
  isCustom?: boolean;
}

const plans: PricingPlan[] = [
  {
    name: "Starter",
    price: 99,
    planId: "starter",
    description: "Perfect for solo recruiters",
    ctaText: "Start 3-Day Trial for $3",
    ctaTextNoTrial: "Get Started - $99/mo",
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
    popular: true,
    ctaText: "Start 3-Day Trial for $3",
    ctaTextNoTrial: "Get Started - $199/mo",
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
    ctaText: "Contact Sales",
    ctaTextNoTrial: "Contact Sales",
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

interface SubscribeCardsProps {
  isRequired?: boolean;
  trialEligible?: boolean;
}

export function SubscribeCards({ isRequired = false, trialEligible = true }: SubscribeCardsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const { data: session } = useSession();
  const activeOrganizationId = session?.session?.activeOrganizationId;

  const getPrice = (basePrice: number, period: "monthly" | "yearly") => {
    if (period === "yearly") {
      const yearlyPrice = basePrice * 12 * 0.75; // 25% discount for yearly
      return Math.round(yearlyPrice);
    }
    return basePrice;
  };

  const handleSelectPlan = async (planId: "starter" | "pro" | "enterprise") => {
    if (planId === "enterprise") {
      // Redirect to contact page for enterprise
      window.location.href = "/contact-sales";
      return;
    }

    // Ensure we have an active organization
    if (!activeOrganizationId) {
      toast.error("No organization selected", {
        description: "Please select or create an organization first",
      });
      return;
    }

    console.log("Starting subscription upgrade:", {
      plan: planId,
      referenceId: activeOrganizationId,
    });

    setIsLoading(true);
    try {
      await subscription.upgrade({
        plan: planId,
        referenceId: activeOrganizationId,
        successUrl: `${window.location.origin}/subscribe/success`,
        cancelUrl: `${window.location.origin}/subscribe`,
      });
    } catch (error) {
      console.error("Subscription upgrade error:", error);
      toast.error("Failed to start checkout", {
        description: error instanceof Error ? error.message : "Please try again",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4">
      <div className="flex justify-center pb-6 mb-2">
        <div className="flex flex-col items-center gap-4">
          <AvatarStack />
        </div>
      </div>
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">
          Simple, Transparent Pricing
        </h1>
        
          <p className="text-lg text-muted-foreground mb-2">
            Choose the perfect plan for your next sourcing. Upgrade anytime.
          </p>
        
        {trialEligible && !isRequired && (
          <>
            <p className="text-xl text-muted-foreground mb-2">
              Start with a 3-day trial for just $3
            </p>
            
          </>
        )}
        
        {!trialEligible && (
          <p className="text-sm text-muted-foreground">
            Select a plan to continue
          </p>
        )}
      </div>

      {/* Billing Period Toggle */}
      <div className="flex justify-center mb-16">
        <div className="inline-flex items-center gap-2 p-1 bg-muted rounded-lg">
          <Button
            variant={billingPeriod === "monthly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setBillingPeriod("monthly")}
            className="px-6"
          >
            Billed Monthly
          </Button>
          <Button
            variant={billingPeriod === "yearly" ? "default" : "ghost"}
            size="sm"
            onClick={() => setBillingPeriod("yearly")}
            className="px-6"
          >
            Billed Yearly
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
              -25%
            </Badge>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const displayPrice = getPrice(plan.price, billingPeriod);
          const periodLabel = billingPeriod === "yearly" ? "/year" : "/month";
          
          return (
            <Card
              key={plan.planId}
              className={`relative flex flex-col ${
                plan.popular ? "border-primary shadow-lg scale-105" : ""
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
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
                    <>
                      <div className="text-4xl font-bold">
                        ${displayPrice}
                        <span className="text-lg font-normal text-muted-foreground">
                          {periodLabel}
                        </span>
                      </div>
                      {billingPeriod === "yearly" && (
                        <p className="text-sm text-green-600 font-semibold mt-2">
                          Save ${Math.round(plan.price * 12 * 0.25)}/year
                        </p>
                      )}
                      {trialEligible && (
                        <p className="text-sm text-green-600 font-semibold mt-2">
                          Try 3 days for $3!
                        </p>
                      )}
                    </>
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
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSelectPlan(plan.planId)}
                  disabled={isLoading}
                >
                  {trialEligible ? plan.ctaText : plan.ctaTextNoTrial}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {!isRequired && (
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold mb-4">Frequently Asked Questions</h3>
          <div className="max-w-3xl mx-auto space-y-6 text-left">
            <div>
              <h4 className="font-semibold mb-2">How does the trial work?</h4>
              <p className="text-muted-foreground">
                Pay $3 to try any plan for 3 days. After the trial, you'll be charged the
                regular monthly rate. Cancel anytime during the trial with no additional charges.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Can I switch plans later?</h4>
              <p className="text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time. Changes will be
                prorated based on your billing cycle.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">What payment methods do you accept?</h4>
              <p className="text-muted-foreground">
                We accept all major credit cards (Visa, Mastercard, American Express) through
                Stripe's secure payment platform.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
