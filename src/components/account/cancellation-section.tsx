"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cancelSubscription, resumeSubscription } from "@/actions/stripe"
import { toast } from "sonner"
import { subscription as subscriptionSchema } from "@/db/schema"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface CancellationSectionProps {
  subscription: typeof subscriptionSchema.$inferSelect;
}

export function CancellationSection({ subscription }: CancellationSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const router = useRouter();

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      const result = await cancelSubscription();
      if (result.success) {
        toast.success("Subscription Canceled");
        router.refresh();
      } else {
        toast.error(result.error || "Only organization owners/admins can manage billing");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      const result = await resumeSubscription();
      if (result.success) {
        toast.success("Subscription Resumed");
        router.refresh();
      } else {
        toast.error(result.error || "Only organization owners/admins can manage billing");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmCancel = async () => {
    setIsCancelDialogOpen(false);
    await handleCancel();
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="rounded-lg border p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="text-base font-semibold">Cancellation</div>
          <p className="text-sm text-muted-foreground">
            {subscription.cancelAtPeriodEnd
              ? "Your plan is scheduled to cancel at the end of the current period."
              : "Cancel your plan at the end of the current billing period."}
          </p>
        </div>
        {subscription.cancelAtPeriodEnd ? (
          <Button
            onClick={handleResume}
            disabled={isLoading}
            variant="default"
          >
            Resume plan
          </Button>
        ) : (
          <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                disabled={isLoading}
                variant="destructive"
              >
                Cancel plan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel plan</AlertDialogTitle>
                <AlertDialogDescription>
                  Cancelling will stop future billing immediately, but you'll retain access until{" "}
                  {formatDate(subscription.periodEnd)}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Go back</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmCancel}
                >
                  Cancel plan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
