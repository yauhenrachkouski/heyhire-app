"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db/drizzle";
import { subscription, user, organization, member } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { isSubscriptionActive } from "@/lib/subscription";
import { getSessionWithOrg } from "@/lib/auth-helpers";
import { trackServerEvent } from "@/lib/posthog/track";
import { Resend } from "resend";
import { SubscriptionCanceledEmail, SubscriptionActivatedEmail } from "@/emails";
import { formatDate } from "@/lib/format";

const resend = new Resend(process.env.RESEND_API_KEY);

async function requireBillingAdmin(activeOrgId: string, userId: string) {
  const memberRecord = await db.query.member.findFirst({
    where: and(
      eq(member.organizationId, activeOrgId),
      eq(member.userId, userId)
    ),
    columns: { role: true },
  });

  const role = memberRecord?.role;
  if (role !== "owner" && role !== "admin") {
    throw new Error("Not authorized");
  }
}

export async function getCustomerPortalPaymentMethodSession() {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg();
    await requireBillingAdmin(activeOrgId, userId);
    const { subscription: orgSubscription } = await getUserSubscription();

    if (!orgSubscription?.stripeCustomerId) {
      return {
        url: null,
        error: "No Stripe customer found for this organization",
      };
    }

    const { stripeClient } = await import("@/lib/auth");

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      "http://localhost:3000";

    const portalSession = await stripeClient.billingPortal.sessions.create({
      customer: orgSubscription.stripeCustomerId,
      return_url: `${baseUrl}/billing`,
      flow_data: {
        type: "payment_method_update",
        after_completion: {
          type: "redirect",
          redirect: {
            return_url: `${baseUrl}/billing`,
          },
        },
      },
    });

    trackServerEvent(userId, "billing_portal_payment_method_session_created", activeOrgId, {
      stripe_customer_id: orgSubscription.stripeCustomerId,
    })

    return {
      url: portalSession.url,
      error: null,
    };
  } catch (error) {
    console.error("Error creating payment method portal session:", error);
    return {
      url: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create billing portal session",
    };
  }
}

export async function getCustomerInvoices(params?: { limit?: number }) {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg();
    await requireBillingAdmin(activeOrgId, userId);

    const { subscription: orgSubscription } = await getUserSubscription();

    if (!orgSubscription?.stripeCustomerId) {
      return {
        invoices: [],
        error: "No Stripe customer found for this organization",
      };
    }

    const { stripeClient } = await import("@/lib/auth");

    const invoices = await stripeClient.invoices.list({
      customer: orgSubscription.stripeCustomerId,
      limit: params?.limit ?? 10,
    });

    return {
      invoices: invoices.data.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        created: invoice.created,
        status: (invoice.status ?? null) as string | null,
        currency: invoice.currency,
        total: invoice.total,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdf: invoice.invoice_pdf ?? null,
      })),
      error: null,
    };
  } catch (error) {
    console.error("Error listing invoices:", error);
    return {
      invoices: [],
      error:
        error instanceof Error ? error.message : "Failed to list invoices",
    };
  }
}

export async function getCustomerPaymentMethods(params?: { limit?: number }) {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg();
    await requireBillingAdmin(activeOrgId, userId);

    const { subscription: orgSubscription } = await getUserSubscription();

    if (!orgSubscription?.stripeCustomerId) {
      return {
        paymentMethods: [],
        defaultPaymentMethodId: null,
        error: "No Stripe customer found for this organization",
      };
    }

    const { stripeClient } = await import("@/lib/auth");

    const customer = await stripeClient.customers.retrieve(orgSubscription.stripeCustomerId);
    const defaultPaymentMethodId = customer.deleted
      ? null
      : ((customer.invoice_settings?.default_payment_method as string | null | undefined) ?? null);

    const paymentMethods = await stripeClient.paymentMethods.list({
      customer: orgSubscription.stripeCustomerId,
      type: "card",
      limit: params?.limit ?? 10,
    });

    return {
      paymentMethods: paymentMethods.data.map((pm) => ({
        id: pm.id,
        type: pm.type,
        brand: pm.card?.brand ?? null,
        last4: pm.card?.last4 ?? null,
        expMonth: pm.card?.exp_month ?? null,
        expYear: pm.card?.exp_year ?? null,
      })),
      defaultPaymentMethodId,
      error: null,
    };
  } catch (error) {
    console.error("Error listing payment methods:", error);
    return {
      paymentMethods: [],
      defaultPaymentMethodId: null,
      error: error instanceof Error ? error.message : "Failed to list payment methods",
    };
  }
}

/**
 * Get the active organization's subscription
 */
export async function getUserSubscription() {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg();
    void userId;

    const orgSubscription = await db.query.subscription.findFirst({
      where: eq(subscription.referenceId, activeOrgId),
    });

    return { subscription: orgSubscription || null, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch subscription";
    if (message.includes("Not authenticated") || message.includes("No active organization")) {
      console.warn("Error fetching subscription:", error);
    } else {
      console.error("Error fetching subscription:", error);
    }
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
    if (error.includes("Not authenticated")) {
      return {
        hasSubscription: false,
        shouldRedirect: true,
        redirectTo: "/auth/signin",
        error,
      };
    }
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
    await requireBillingAdmin(activeOrgId, userId);
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
 * Immediately end the trial and start paid billing
 */
export async function startProBillingNow() {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg();
    await requireBillingAdmin(activeOrgId, userId);
    const { subscription: orgSubscription } = await getUserSubscription();

    if (!orgSubscription) {
      return {
        success: false,
        error: "No subscription found",
      };
    }

    if (orgSubscription.status !== "trialing") {
      return {
        success: false,
        error: "Only trial subscriptions can be unlocked early",
      };
    }

    if (!orgSubscription.stripeSubscriptionId) {
      return {
        success: false,
        error: "Missing Stripe subscription",
      };
    }

    const { stripeClient } = await import("@/lib/auth");

    const updatedSubscription = await stripeClient.subscriptions.update(
      orgSubscription.stripeSubscriptionId,
      {
        trial_end: "now",
        billing_cycle_anchor: "now",
        cancel_at_period_end: false,
        proration_behavior: "always_invoice",
      }
    );

    trackServerEvent(userId, "trial_unlocked_now", activeOrgId, {
      stripe_subscription_id: orgSubscription.stripeSubscriptionId,
    });

    const nextBillingDate = updatedSubscription.current_period_end
      ? new Date(updatedSubscription.current_period_end * 1000)
      : null;

    return {
      success: true,
      nextBillingDate,
      error: null,
    };
  } catch (error) {
    console.error("Error unlocking trial:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to unlock trial",
    };
  }
}

/**
 * Cancel organization subscription at period end
 */
export async function cancelSubscription() {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg();
    await requireBillingAdmin(activeOrgId, userId);
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

    const cancelAt = (canceledSubscription as any).cancel_at;
    const formattedCancelDate = cancelAt
      ? formatDate(cancelAt * 1000, { month: "long", day: "numeric", year: "2-digit" })
      : "Unknown date";

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
          subject: `Subscription will cancel on ${formattedCancelDate}`,
          react: emailContent,
        });
      }
    } catch (e) {
      console.warn("Failed to send cancel confirmation email", e);
    }

    return {
      success: true,
      message: `Your subscription will be canceled at the end of your billing period on ${formattedCancelDate}`,
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
    await requireBillingAdmin(activeOrgId, userId);
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

/**
 * Set a payment method as the default for the customer
 */
export async function setDefaultPaymentMethod(paymentMethodId: string) {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg();
    await requireBillingAdmin(activeOrgId, userId);
    const { subscription: orgSubscription } = await getUserSubscription();

    if (!orgSubscription?.stripeCustomerId) {
      return {
        success: false,
        error: "No Stripe customer found for this organization",
      };
    }

    const { stripeClient } = await import("@/lib/auth");

    // Update the customer's default payment method
    await stripeClient.customers.update(orgSubscription.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    trackServerEvent(userId, "payment_method_set_default", activeOrgId, {
      stripe_customer_id: orgSubscription.stripeCustomerId,
      payment_method_id: paymentMethodId,
    });

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Error setting default payment method:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to set default payment method",
    };
  }
}

/**
 * Remove a payment method from the customer
 */
export async function removePaymentMethod(paymentMethodId: string) {
  try {
    const { activeOrgId, userId } = await getSessionWithOrg();
    await requireBillingAdmin(activeOrgId, userId);
    const { subscription: orgSubscription } = await getUserSubscription();

    if (!orgSubscription?.stripeCustomerId) {
      return {
        success: false,
        error: "No Stripe customer found for this organization",
      };
    }

    const { stripeClient } = await import("@/lib/auth");

    // Get the current default payment method
    const customer = await stripeClient.customers.retrieve(orgSubscription.stripeCustomerId);
    const currentDefaultId = customer.deleted
      ? null
      : ((customer.invoice_settings?.default_payment_method as string | null | undefined) ?? null);

    // Detach the payment method from the customer
    await stripeClient.paymentMethods.detach(paymentMethodId);

    // If this was the default payment method, we might need to handle this
    // Stripe will automatically handle setting a new default if available

    trackServerEvent(userId, "payment_method_removed", activeOrgId, {
      stripe_customer_id: orgSubscription.stripeCustomerId,
      payment_method_id: paymentMethodId,
      was_default: currentDefaultId === paymentMethodId,
    });

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error("Error removing payment method:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove payment method",
    };
  }
}
