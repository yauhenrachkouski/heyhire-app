import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconCheck, IconInfoCircle, IconLock } from "@tabler/icons-react";
import { SubscribeFAQ } from "@/components/subscribe/subscribe-faq";
import { SubscribeSupport } from "@/components/subscribe/subscribe-support";
import { SubscribeCheckoutButton } from "@/components/subscribe/subscribe-checkout-button";
import { UnlockProNowButton } from "@/components/account/unlock-pro-now-button";
import { PLAN_LIMITS } from "@/types/plans";
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
  isTrialing?: boolean;
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
  isTrialing = false,
}: SubscribeCardsServerProps) {
  void isRequired;
  void isTrialEligible;

  const visiblePlans = plans;

  return (
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 gap-8 max-w-4xl mx-auto md:grid-cols-2">
        {visiblePlans.map((plan) => {
          const displayPrice = plan.price;
          const periodLabel = plan.billingLabel;

          const isCurrent = !!currentPlan && currentPlan === plan.planId;
          const isTrialUserForPro = isCurrent && isTrialing;
          const planCredits = PLAN_LIMITS[plan.planId].credits;

          const ctaText = (() => {
            if (isTrialUserForPro) return "Unlock full Pro now";
            if (isCurrent) return "Current plan";
            return plan.ctaText;
          })();
          
          return (
            <Card
              key={plan.planId}
              className={`relative flex flex-col max-w-md w-full mx-auto ${
                plan.popular ? "border-primary shadow-lg scale-105" : ""
              } overflow-visible`}
            >
             

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                {isTrialUserForPro && (
                  <div className="pt-2">
                    <Badge variant="secondary">Trial · 100 reveals</Badge>
                  </div>
                )}
                {!isTrialUserForPro && isCurrent && (
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
                      <p className="text-xs text-muted-foreground">{planCredits} reveals/month</p>
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

              <CardFooter className="flex flex-col gap-2">
                {isTrialUserForPro ? (
                  <>
                    <UnlockProNowButton
                      className="w-full"
                      variant="default"
                      size="lg"
                      planId={plan.planId}
                    >
                      Unlock full Pro now
                    </UnlockProNowButton>
                    <p className="text-xs text-muted-foreground text-center">
                      Charged today • Trial ends now
                    </p>
                  </>
                ) : isCurrent ? (
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

        <Card className="relative flex flex-col border-dashed border-primary/40">
          <CardHeader>
            <Badge className="w-fit mb-2" variant="secondary">
              Need more?
            </Badge>
            <CardTitle className="text-2xl">Custom volume plans</CardTitle>
            <CardDescription>
              Go beyond 1,000 reveals per month with a package built for your team.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col justify-between">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <IconCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                Flexible reveal blocks
              </li>
              <li className="flex items-start gap-2">
                <IconCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                Priority support & onboarding
              </li>
              <li className="flex items-start gap-2">
                <IconCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                Consolidated billing
              </li>
            </ul>
          </CardContent>

          <CardFooter>
            <Button asChild className="w-full" size="lg">
              <a href="https://cal.com/yauhenrachkouski" target="_blank" rel="noreferrer">
                Book a call
              </a>
            </Button>
          </CardFooter>
        </Card>
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
