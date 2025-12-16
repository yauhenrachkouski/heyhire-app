import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCheck, IconInfoCircle, IconLock } from "@tabler/icons-react";
import { initiateSubscriptionCheckout, initiateTrialCheckout } from "@/actions/subscription";
import { SubscribeFAQ } from "@/components/subscribe/subscribe-faq";
import { SubscribeSupport } from "@/components/subscribe/subscribe-support";
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
  planId: "standard" | "trial";
  billingLabel: "/month" | "one-time";
  ctaText: string;
  ctaTextNoTrial: string;
}

const plans: PricingPlan[] = [
  {
    name: "Trial",
    price: 9,
    planId: "trial",
    billingLabel: "one-time",
    description: "7 days access + 100 reveals included",
    ctaText: "Start Trial",
    ctaTextNoTrial: "Trial unavailable",
    features: [
      "Search across 100M+ profiles",
      "100 reveals included",
      "Support included",
    ],
  },
  {
    name: "Standard",
    price: 69,
    planId: "standard",
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
  trialEligible?: boolean;
  showSupportSections?: boolean;
}

interface SubscribeHeaderProps {
  isRequired?: boolean;
  trialEligible?: boolean;
}

export function SubscribeHeader({ isRequired = false, trialEligible = true }: SubscribeHeaderProps) {
  return (
    <div className="text-center mb-8">
      <h1 className="text-4xl font-bold mb-4">
        Simple, Transparent Pricing
      </h1>

      <p className="text-lg text-muted-foreground mb-2">
        Choose the perfect plan for your next sourcing. Upgrade anytime.
      </p>

      {trialEligible && (
        <p className="text-xl text-muted-foreground mb-2">
          Start with a 7-day trial ($9 one-time, available once)
        </p>
      )}
    </div>
  );
}

export function SubscribeCardsServer({
  isRequired = false,
  trialEligible = true,
  showSupportSections = true,
}: SubscribeCardsServerProps) {
  return (
    <div className="container mx-auto px-4">
      <div className="grid md:grid-cols-1 gap-8 max-w-2xl mx-auto">
        {plans.map((plan) => {
          if (plan.planId === "trial" && !trialEligible) {
            return null;
          }

          const displayPrice = plan.price;
          const periodLabel = plan.billingLabel === "one-time" ? "" : plan.billingLabel;
          
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
                      {periodLabel ? (
                        <span className="text-lg font-normal text-muted-foreground">
                          {periodLabel}
                        </span>
                      ) : (
                        <span className="text-lg font-normal text-muted-foreground">
                          one-time
                        </span>
                      )}
                    </div>
                    {plan.planId === "trial" && (
                      <p className="text-sm text-green-600 font-semibold mt-2">
                        One-time trial (available once)
                      </p>
                    )}
                  </>
                  <div className="mt-3 space-y-1">
                    {plan.planId === "standard" ? (
                      <>
                        <p className="text-xs text-muted-foreground">Billed monthly</p>
                        <p className="text-xs text-muted-foreground">1,000 reveals/month</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">Cancel anytime.</p>
                        <p className="text-xs text-muted-foreground">Secure checkout with Stripe.</p>
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
                <form action={plan.planId === "trial" ? initiateTrialCheckout : initiateSubscriptionCheckout} className="w-full">
                  {plan.planId !== "trial" && (
                    <input type="hidden" name="plan" value={plan.planId} />
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    variant={plan.planId === "standard" ? "default" : "outline"}
                  >
                    {plan.planId === "trial" ? plan.ctaText : (trialEligible ? plan.ctaText : plan.ctaTextNoTrial)}
                  </Button>

                  
                </form>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {showSupportSections && (
        <SubscribeFAQ trialEligible={trialEligible} />
      )}

      {showSupportSections && (
        <SubscribeSupport />
      )}
    </div>
  );
}

