"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSubscriptionStatus } from "@/actions/stripe";
import { IconCheck } from "@tabler/icons-react";
import Image from "next/image";
import heyhireLogo from "@/assets/heyhire_logo.svg";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

export default function SubscribeSuccessPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        // Check for subscription with retries to allow webhook to process
        for (let i = 0; i < 5; i++) {
          const status = await getSubscriptionStatus();

          if (status.isActive) {
            setIsReady(true);
            setIsChecking(false);
            return;
          }

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 300));
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

  useEffect(() => {
    if (!isReady) return;

    const timeout = setTimeout(() => {
      router.replace("/");
    }, 600);

    return () => clearTimeout(timeout);
  }, [isReady, router]);

  return (
    <div className="flex min-h-svh flex-col p-6 md:p-10">
      <div className="flex justify-center gap-2 md:justify-start">
        <a href="/" className="flex items-center gap-2 font-medium">
          <Image
            src={heyhireLogo}
            alt="HeyHire"
            width={100}
            height={25}
          />
        </a>
      </div>
      <div className="flex min-h-0 w-full flex-1 items-center justify-center px-6">
        <div className="w-full max-w-2xl">
          <Empty className="p-6 sm:p-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <div
                  className="flex size-10 items-center justify-center"
                  style={{
                    animation: isReady ? "scale-in 0.5s ease-out forwards" : "none",
                  }}
                >
                  {isChecking ? (
                    <div className="h-6 w-6 animate-spin rounded-full border-3 border-foreground/20 border-t-foreground" />
                  ) : (
                    <IconCheck className="size-6" stroke={3} />
                  )}
                </div>
              </EmptyMedia>
              <EmptyTitle>
                {isChecking ? "Setting things up..." : "Welcome to HeyHire!"}
              </EmptyTitle>
              <EmptyDescription>
                {isChecking
                  ? "Please wait while we activate your subscription."
                  : "Your subscription is now active. You're all set to discover and connect with amazing candidates."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>

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
