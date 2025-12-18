import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCheck, IconInfoCircle, IconLock } from "@tabler/icons-react";
import { SubscribeFAQ } from "@/components/subscribe/subscribe-faq";
import { SubscribeSupport } from "@/components/subscribe/subscribe-support";
import { SubscribeCheckoutButton } from "@/components/subscribe/subscribe-checkout-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PlanId } from "@/types/plans";

interface PricingPlan {
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  planId: PlanId;
  billingLabel: "/month";
  ctaText: string;
  ctaTextNoTrial: string;
}

const plans: PricingPlan[] = [
  {
    name: "Pro",
    price: 69,
    planId: "pro",
    billingLabel: "/month",
    description: "3-day free trial",
    popular: true,
    ctaText: "Start free trial",
    ctaTextNoTrial: "Get started",
    features: [
      "Advanced matching algorithm",
      "Reveal up to 1,000 candidates",
      "Fine-tune your criteria",
      "Search across 100M+ profiles",
      "Support included",
    ],
  },
];

interface SubscribeCardsServerProps {
  isRequired?: boolean;
  isTrialEligible?: boolean;
  showSupportSections?: boolean;
  currentPlan?: PlanId | null;
}

interface SubscribeHeaderProps {
  isRequired?: boolean;
  isTrialEligible?: boolean;
  currentPlan?: PlanId | null;
}

export function SubscribeHeader({ isRequired = false, isTrialEligible = true, currentPlan }: SubscribeHeaderProps) {
  return (
    <div className="text-center mb-8">
      <h1 className="text-4xl font-bold mb-4">
        Simple, Transparent Pricing
      </h1>

      <p className="text-lg text-muted-foreground mb-2">
        Choose the perfect plan for your next sourcing. Upgrade anytime.
      </p>

    </div>
  );
}

export function SubscribeCardsServer({
  isRequired = false,
  isTrialEligible = true,
  showSupportSections = true,
  currentPlan,
}: SubscribeCardsServerProps) {
  void isRequired;
  void isTrialEligible;

  const visiblePlans = plans;

  return (
    <div className="container mx-auto px-4">
      <div
        className={`grid grid-cols-1 gap-8 max-w-4xl mx-auto ${
          visiblePlans.length === 1 ? "md:grid-cols-1" : "md:grid-cols-2"
        }`}
      >
        {visiblePlans.map((plan) => {
          const displayPrice = plan.price;
          const periodLabel = plan.billingLabel;

          const isCurrent = !!currentPlan && currentPlan === plan.planId;

          const ctaText = (() => {
            if (isCurrent) return "Current plan";
            return plan.ctaText;
          })();
          
          return (
            <Card
              key={plan.planId}
              className={`relative flex flex-col ${
                plan.popular ? "border-primary shadow-lg scale-105" : ""
              } overflow-visible`}
            >
             

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                {isCurrent && (
                  <div className="pt-2">
                    <Badge variant="secondary">Current plan</Badge>
                  </div>
                )}
              </CardHeader>

              <CardContent className="flex-1">
                <div className="mb-5">
                  <>
                    <div className="text-4xl font-bold">
                      ${displayPrice}
                      <span className="text-lg font-normal text-muted-foreground">
                        {periodLabel}
                      </span>
                    </div>
                    
                  </>
                  <div className="mt-3 space-y-1">
                    <>
                      <p className="text-xs text-muted-foreground">Billed monthly after trial</p>
                      <p className="text-xs text-muted-foreground">1,000 reveals/month</p>
                    </>
                  </div>
                </div>

                <ul className="space-y-2.5">
                  {plan.features.map((feature, index) => {
                    const isReveal = feature.toLowerCase().includes("reveal");
                    return (
                      <li key={index} className="flex items-start gap-2 leading-relaxed">
                        <IconCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">
                          {feature}
                          {isReveal && (
                            <Tooltip
                              onOpenChange={(open) => {
                                if (open && document.activeElement?.tagName === "BUTTON") {
                                  (document.activeElement as HTMLButtonElement).blur();
                                }
                              }}
                            >
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="ml-2 inline-flex items-center text-muted-foreground hover:text-foreground"
                                  aria-label="What does reveal mean?"
                                >
                                  <IconInfoCircle className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent sideOffset={6}>
                                Reveal = unlock profile URL / contact details
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>

              <CardFooter>
                {isCurrent ? (
                  <Button className="w-full" size="lg" variant="outline" disabled>
                    Current plan
                  </Button>
                ) : (
                  <SubscribeCheckoutButton
                    plan={plan.planId}
                    className="w-full"
                    variant={"default"}
                  >
                    {ctaText}
                  </SubscribeCheckoutButton>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {showSupportSections && (
        <SubscribeFAQ isTrialEligible={isTrialEligible} />
      )}

      {showSupportSections && (
        <SubscribeSupport />
      )}
    </div>
  );
}

