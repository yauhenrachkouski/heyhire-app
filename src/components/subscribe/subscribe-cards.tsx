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

interface PricingPlan {
  name: string;
  price: number;
  description: string;
  features: string[];
  popular?: boolean;
  planId: "starter" | "pro";
  billingLabel: "/month";
  ctaText: string;
  ctaTextNoTrial: string;
}

const plans: PricingPlan[] = [
  {
    name: "Starter",
    price: 29,
    planId: "starter",
    billingLabel: "/month",
    description: "7-day free trial",
    ctaText: "Start free trial",
    ctaTextNoTrial: "Get started",
    features: [
      "Search across 100M+ profiles",
      "300 reveals included",
      "Support included",
    ],
  },
  {
    name: "Pro",
    price: 69,
    planId: "pro",
    billingLabel: "/month",
    description: "Everything you need to source candidates",
    popular: true,
    ctaText: "Start sourcing",
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
}

interface SubscribeHeaderProps {
  isRequired?: boolean;
  isTrialEligible?: boolean;
}

export function SubscribeHeader({ isRequired = false, isTrialEligible = true }: SubscribeHeaderProps) {
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
                    {plan.planId === "pro" ? (
                      <>
                        <p className="text-xs text-muted-foreground">Billed monthly</p>
                        <p className="text-xs text-muted-foreground">1,000 reveals/month</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">Billed monthly after trial</p>
                        <p className="text-xs text-muted-foreground">300 reveals/month</p>
                      </>
                    )}
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
                            <Tooltip>
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
                <SubscribeCheckoutButton
                  plan={plan.planId}
                  className="w-full"
                  variant={plan.planId === "pro" ? "default" : "outline"}
                >
                  {plan.ctaText}
                </SubscribeCheckoutButton>
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

