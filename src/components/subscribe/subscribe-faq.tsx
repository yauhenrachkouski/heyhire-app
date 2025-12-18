import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface SubscribeFAQProps {
  isTrialEligible?: boolean;
}

export function SubscribeFAQ({ isTrialEligible = true }: SubscribeFAQProps) {
  return (
    <div className="mt-16 max-w-3xl mx-auto">
      <h3 className="text-3xl font-bold mb-4">Frequently Asked Questions</h3>
      <div>
        <Accordion type="single" collapsible defaultValue="is-this-for-me">
          <AccordionItem value="is-this-for-me" className="not-last:border-0">
            <AccordionTrigger className="text-base">
              <div className="text-left">
                <div>Is this for me?</div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-base leading-relaxed">
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  HeyHire is best for recruiters, agency sourcers, and hiring managers.
                </p>
                <p className="text-muted-foreground">
                  It&apos;s a good fit if you need to search lots of profiles and only reveal details when you&apos;re ready to reach out.
                </p>
                <p className="text-muted-foreground">
                  If you&apos;re doing a one-off hire, starting with the trial is usually a better fit.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="how-pricing-works" className="not-last:border-0">
            <AccordionTrigger className="text-base">
              <div className="text-left">
                <div>How does pricing work?</div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-base leading-relaxed">
              <p className="text-muted-foreground">
                Your subscription includes access to candidate search.
              </p>
              <p className="text-muted-foreground">
                Subscriptions renew monthly until you cancel.
              </p>
              <p className="text-muted-foreground">
                When you&apos;re ready to contact someone, you reveal their profile URL using credits.
                Each reveal costs 1 credit.
              </p>
              <p className="text-muted-foreground">
                Reveal credits reset each month and unused reveals don&apos;t roll over.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="what-is-a-reveal" className="not-last:border-0">
            <AccordionTrigger className="text-base">
              <div className="text-left">
                <div>What is a “reveal” credit?</div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-base leading-relaxed">
              <p className="text-muted-foreground">
                A reveal is when you unlock a candidate’s URL so you can contact them. We only charge a credit when you choose to reveal.
              </p>
              <p className="text-muted-foreground">
                If you export candidates, reveals can be applied in bulk during export — each exported (revealed) profile uses 1 credit.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="trial" className="not-last:border-0">
            <AccordionTrigger className="text-base">
              <div className="text-left">
                <div>Is there a free trial?</div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-base leading-relaxed">
              <p className="text-muted-foreground">
                {isTrialEligible
                  ? "If you’re eligible, you’ll see the trial option in checkout. Trials are available once per organization."
                  : "Your organization has already used its trial. You can still subscribe anytime to continue using HeyHire."}
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cancel" className="not-last:border-0">
            <AccordionTrigger className="text-base">
              <div className="text-left">
                <div>Can I cancel anytime?</div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-base leading-relaxed">
              <p className="text-muted-foreground">
                Yes. You can cancel anytime from the Stripe billing portal. Your access continues until the end of your current billing period.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="payments" className="not-last:border-0">
            <AccordionTrigger className="text-base">
              <div className="text-left">
                <div>What payment methods do you accept?</div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-base leading-relaxed">
              <p className="text-muted-foreground">
                We accept major credit cards through Stripe’s secure checkout.
              </p>
              <p className="text-muted-foreground">
                Invoices are available.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
