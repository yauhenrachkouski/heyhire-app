"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { subscription, user, organization } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isSubscriptionActive } from "@/lib/subscription";
import { getSessionWithOrg } from "@/lib/auth-helpers";
import { trackServerEvent } from "@/lib/posthog/track";
import { Resend } from "resend";
import { SubscriptionCanceledEmail, SubscriptionActivatedEmail } from "@/emails";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Get the active organization's subscription
 */
export async function getUserSubscription() {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg();
    console.log("activeOrgId", activeOrgId);
    // First try: Look up by organization ID
    let orgSubscription = await db.query.subscription.findFirst({
      where: eq(subscription.referenceId, activeOrgId),
    });
    console.log("orgSubscription by orgId", orgSubscription);

    // Fallback: If not found by org ID, try looking up by user's stripe customer
    // This handles legacy subscriptions created with user ID as referenceId
    if (!orgSubscription) {
      console.log("Subscription not found by orgId, trying fallback by stripeCustomerId");
      const userRecord = await db.query.user.findFirst({
        where: eq(user.id, userId),
      });

      if (userRecord?.stripeCustomerId) {
        console.log("Looking for subscription with stripeCustomerId:", userRecord.stripeCustomerId);
        orgSubscription = await db.query.subscription.findFirst({
          where: eq(subscription.stripeCustomerId, userRecord.stripeCustomerId),
        });
        console.log("Found subscription via fallback:", orgSubscription?.id);
      }
    }

    return { subscription: orgSubscription || null, error: null };
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return { subscription: null, error: error instanceof Error ? error.message : "Failed to fetch subscription" };
  }
}

/**
 * Get an organization's subscription
 */
export async function getOrganizationSubscription(organizationId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { subscription: null, error: "Not authenticated" };
  }

  try {
    const orgSubscription = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, organizationId))
      .limit(1);

    return { subscription: orgSubscription[0] || null, error: null };
  } catch (error) {
    console.error("Error fetching organization subscription:", error);
    return { subscription: null, error: "Failed to fetch organization subscription" };
  }
}

/**
 * Check if the active organization has a subscription
 */
export async function requireActiveSubscription() {
  const { subscription: orgSubscription, error } = await getUserSubscription();

  if (error) {
    return {
      hasSubscription: false,
      shouldRedirect: true,
      redirectTo: error.includes("No active organization") ? "/onboarding" : "/paywall",
      error,
    };
  }

  if (!orgSubscription) {
    return {
      hasSubscription: false,
      shouldRedirect: true,
      redirectTo: "/paywall",
      error: "No subscription found",
    };
  }

  const isActive = isSubscriptionActive(orgSubscription);

  return {
    hasSubscription: isActive,
    shouldRedirect: !isActive,
    redirectTo: isActive ? null : "/paywall",
    subscription: orgSubscription,
    error: null,
  };
}

/**
 * Get subscription status with helpful metadata
 */
export async function getSubscriptionStatus() {
  const { subscription: orgSubscription, error } = await getUserSubscription();

  if (error) {
    return { status: null, error };
  }

  if (!orgSubscription) {
    return {
      status: "none",
      isActive: false,
      plan: null,
      error: null,
    };
  }

  const isActive = isSubscriptionActive(orgSubscription);
  const isTrialing = orgSubscription.status === "trialing";
  const willCancel = orgSubscription.cancelAtPeriodEnd;

  return {
    status: orgSubscription.status,
    isActive,
    isTrialing,
    willCancel,
    plan: orgSubscription.plan,
    periodEnd: orgSubscription.periodEnd,
    trialEnd: orgSubscription.trialEnd,
    seats: orgSubscription.seats,
    error: null,
  };
}

/**
 * Get Stripe Customer Portal URL for subscription management
 */
export async function getCustomerPortalSession() {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg(); // Verify session exists
    const { subscription: orgSubscription } = await getUserSubscription();

    if (!orgSubscription?.stripeCustomerId) {
      return {
        url: null,
        error: "No Stripe customer found for this organization",
      };
    }

    // Dynamic import to access stripeClient
    const { stripeClient } = await import("@/lib/auth");

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";

    const portalSession = await stripeClient.billingPortal.sessions.create({
      customer: orgSubscription.stripeCustomerId,
      return_url: `${baseUrl}/billing`,
    });

    trackServerEvent(userId, "billing_portal_session_created", activeOrgId, {
      stripe_customer_id: orgSubscription.stripeCustomerId,
    })

    return {
      url: portalSession.url,
      error: null,
    };
  } catch (error) {
    console.error("Error creating customer portal session:", error);
    return {
      url: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create billing portal session",
    };
  }
}

/**
 * Cancel organization subscription at period end
 */
export async function cancelSubscription() {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg();
    const { subscription: orgSubscription } = await getUserSubscription();

    if (!orgSubscription?.stripeSubscriptionId) {
      return {
        success: false,
        error: "No active subscription found",
      };
    }

    // Dynamic import to access stripeClient
    const { stripeClient } = await import("@/lib/auth");

    const canceledSubscription = await stripeClient.subscriptions.update(
      orgSubscription.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    trackServerEvent(userId, "subscription_cancel_requested", activeOrgId, {
      stripe_subscription_id: orgSubscription.stripeSubscriptionId,
    })

    // Update database record
    await db
      .update(subscription)
      .set({
        cancelAtPeriodEnd: true,
      })
      .where(eq(subscription.referenceId, activeOrgId));

    const endDate = new Date((canceledSubscription as any).current_period_end * 1000);

    try {
      const orgRecord = await db.query.organization.findFirst({
        where: eq(organization.id, activeOrgId),
        columns: { name: true },
      });

      const userRecord = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: { email: true, name: true },
      });

      if (userRecord?.email) {
        const emailContent = SubscriptionCanceledEmail({
          organizationName: orgRecord?.name || activeOrgId,
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`,
        });
        await resend.emails.send({
          from: process.env.EMAIL_FROM as string,
          to: userRecord.email,
          subject: `Subscription will cancel on ${endDate.toLocaleDateString()}`,
          react: emailContent,
        });
      }
    } catch (e) {
      console.warn("Failed to send cancel confirmation email", e);
    }

    return {
      success: true,
      message: `Your subscription will be canceled at the end of your billing period on ${endDate.toLocaleDateString()}`,
      error: null,
    };
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to cancel subscription",
    };
  }
}

/**
 * Resume a subscription that was canceled at period end
 */
export async function resumeSubscription() {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg();
    const { subscription: orgSubscription } = await getUserSubscription();

    if (!orgSubscription?.stripeSubscriptionId) {
      return {
        success: false,
        error: "No active subscription found",
      };
    }

    // Dynamic import to access stripeClient
    const { stripeClient } = await import("@/lib/auth");

    await stripeClient.subscriptions.update(
      orgSubscription.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      }
    );

    trackServerEvent(userId, "subscription_resume_requested", activeOrgId, {
      stripe_subscription_id: orgSubscription.stripeSubscriptionId,
    })

    // Update database record
    await db
      .update(subscription)
      .set({
        cancelAtPeriodEnd: false,
      })
      .where(eq(subscription.referenceId, activeOrgId));

    try {
      const orgRecord = await db.query.organization.findFirst({
        where: eq(organization.id, activeOrgId),
        columns: { name: true },
      });

      const userRecord = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: { email: true, name: true },
      });

      if (userRecord?.email) {
        const emailContent = SubscriptionActivatedEmail({
          organizationName: orgRecord?.name || activeOrgId,
          planName: orgSubscription?.plan || "standard",
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`,
        });
        await resend.emails.send({
          from: process.env.EMAIL_FROM as string,
          to: userRecord.email,
          subject: "Subscription resumed",
          react: emailContent,
        });
      }
    } catch (e) {
      console.warn("Failed to send resume confirmation email", e);
    }

    return {
      success: true,
      message: "Your subscription has been resumed",
      error: null,
    };
  } catch (error) {
    console.error("Error resuming subscription:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to resume subscription",
    };
  }
}

