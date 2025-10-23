"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSubscriptionStatus } from "@/actions/stripe";

export default function SubscribeSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        // Check for subscription with retries to allow webhook to process
        for (let i = 0; i < 10; i++) {
          const status = await getSubscriptionStatus();
          
          if (status.isActive) {
            // Give it a moment then redirect
            setTimeout(() => {
              router.push("/");
            }, 500);
            return;
          }
          
          // Wait 500ms before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // If no active subscription after retries, redirect anyway
        // The middleware will handle the redirect to /subscribe if needed
        router.push("/");
      } catch (error) {
        console.error("Error checking subscription:", error);
        // On error, redirect to home anyway
        router.push("/");
      }
    };

    checkSubscription();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Processing your subscription...</h1>
        <p className="text-muted-foreground mb-8">
          Please wait while we activate your account.
        </p>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    </div>
  );
}
