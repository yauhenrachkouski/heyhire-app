import { Button } from "@/components/ui/button";
import Link from "next/link";

export function SubscribeSupport() {
  return (
    <div className="max-w-3xl mx-auto mt-16">
      <div className="p-1">
        <div className="mt-4 rounded-xl border bg-muted/30 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-base font-semibold">Still have questions?</p>
              <p className="text-sm text-muted-foreground mt-1">
                We&apos;re here to help. Don&apos;t hesitate to reach out to us.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button  size="sm" className="shrink-0" asChild>
                <a href="https://wa.me/48572121572" target="_blank" rel="noopener noreferrer">
                  WhatsApp chat
                </a>
              </Button>
              <Button variant="outline" size="sm" className="shrink-0" asChild>
                <a href="mailto:support@heyhire.ai">Email support</a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
