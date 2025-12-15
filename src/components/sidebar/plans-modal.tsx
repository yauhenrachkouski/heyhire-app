"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { getCustomerPortalSession } from "@/actions/stripe";
import { toast } from "sonner";

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

interface PlansModalProps {
  children: React.ReactNode;
  currentPlan?: "starter" | "pro" | "enterprise" | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PlansModal({ children, currentPlan, open, onOpenChange }: PlansModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isControlled = open !== undefined && onOpenChange !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;

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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:!max-w-[95vw] md:!max-w-[1400px] max-h-[90vh] overflow-y-auto">
        <div className="text-center my-8">
          <DialogTitle className="text-4xl font-bold mb-4">
            Choose Your Plan
          </DialogTitle>
          <p className="text-lg text-muted-foreground">
            Select the plan that best fits your needs
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
                    {isCurrentPlan ? "Current Plan" : plan.isCustom ? "Contact Sales" : "Choose Plan"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}




