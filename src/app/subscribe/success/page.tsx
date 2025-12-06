"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSubscriptionStatus } from "@/actions/stripe";
import { Button } from "@/components/ui/button";
import { IconCheck, IconArrowRight } from "@tabler/icons-react";
import Image from "next/image";
import { SupportModal } from "@/components/sidebar/support-modal";

export default function SubscribeSuccessPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        // Check for subscription with retries to allow webhook to process
        for (let i = 0; i < 10; i++) {
          const status = await getSubscriptionStatus();

          if (status.isActive) {
            setIsReady(true);
            setIsChecking(false);
            return;
          }

          // Wait 500ms before retrying
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // If no active subscription after retries, show ready anyway
        // User can click button and middleware will handle appropriately
        setIsReady(true);
        setIsChecking(false);
      } catch (error) {
        console.error("Error checking subscription:", error);
        setIsReady(true);
        setIsChecking(false);
      }
    };

    checkSubscription();
  }, []);

  const handleStartUsing = () => {
    router.push("/");
  };

  return (
    <div className="flex min-h-svh flex-col p-6 md:p-10">
      <div className="flex justify-center gap-2 md:justify-start">
        <a href="/" className="flex items-center gap-2 font-medium">
          <Image
            src="/heyhire_logo.svg"
            alt="HeyHire"
            width={100}
            height={25}
          />
        </a>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-lg">
          <div className="flex flex-col items-center text-center">
            {/* Success icon */}
            <div
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary"
              style={{
                animation: isReady ? "scale-in 0.5s ease-out forwards" : "none",
              }}
            >
              {isChecking ? (
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-foreground border-t-transparent" />
              ) : (
                <IconCheck className="h-10 w-10 text-primary-foreground" stroke={3} />
              )}
            </div>

            {/* Welcome message */}
            <h1 className="mb-3 text-3xl font-bold tracking-tight md:text-4xl">
              {isChecking ? "Setting things up..." : "Welcome to HeyHire!"}
            </h1>

            <p className="mb-8 max-w-md text-lg text-muted-foreground">
              {isChecking
                ? "Please wait while we activate your subscription."
                : "Your subscription is now active. You're all set to discover and connect with amazing candidates."}
            </p>

            {/* CTA Button */}
            <Button
              onClick={handleStartUsing}
              disabled={!isReady}
              size="lg"
              className="h-12 min-w-[200px] text-base font-medium"
            >
              {isChecking ? (
                "Activating..."
              ) : (
                <>
                  Start using HeyHire
                  <IconArrowRight className="h-5 w-5" />
                </>
              )}
            </Button>

            {/* Support note */}
            <p className="mt-6 text-sm text-muted-foreground">
              Need help?{" "}
              <button
                onClick={() => setSupportModalOpen(true)}
                className="text-primary hover:underline"
              >
                Contact support
              </button>
            </p>
          </div>
        </div>
      </div>

      <SupportModal open={supportModalOpen} onOpenChange={setSupportModalOpen} />

      <style jsx>{`
        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
