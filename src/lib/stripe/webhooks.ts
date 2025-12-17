import Stripe from "stripe";
import { db } from "@/db/drizzle";
import { subscription as subscriptionTable, member } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPostHogServer } from "@/lib/posthog/posthog-server";
import { generateId } from "@/lib/id";
import { grantPlanCredits, revokeCredits } from "./subscription-service";

// =============================================================================
// TYPES
// =============================================================================

type StripeEvent = Stripe.Event;

interface WebhookContext {
    stripeClient: Stripe;
    event: StripeEvent;
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

/**
 * Main Stripe webhook event handler
 * Routes events to appropriate handlers
 */
export async function handleStripeEvent(event: StripeEvent, stripeClient: Stripe) {
    const timestamp = new Date().toISOString();
    console.log(`\n[Stripe Webhook] ${timestamp} - ${event.type} (${event.id})`);

    // Track webhook received
    try {
        const posthog = getPostHogServer();
        posthog.capture({
            distinctId: "stripe_webhook",
            event: "stripe_webhook_received",
            properties: {
                stripe_event_id: event.id,
                stripe_event_type: event.type,
            },
        });
    } catch (e) {
        console.error("[PostHog] Failed to capture stripe_webhook_received", e);
    }

    const ctx: WebhookContext = { stripeClient, event };

    try {
        switch (event.type) {
            // Checkout events
            case "checkout.session.completed":
                await handleCheckoutCompleted(ctx);
                break;
            case "checkout.session.expired":
                await handleCheckoutExpired(ctx);
                break;

            // Subscription events
            case "customer.subscription.created":
            case "customer.subscription.updated":
                await handleSubscriptionUpdated(ctx);
                break;
            case "customer.subscription.deleted":
                await handleSubscriptionDeleted(ctx);
                break;

            // Invoice events
            case "invoice.payment_succeeded":
                await handleInvoicePaymentSucceeded(ctx);
                break;
            case "invoice.payment_failed":
                await handleInvoicePaymentFailed(ctx);
                break;

            // Payment risk events
            case "charge.refunded":
            case "refund.created":
            case "charge.dispute.created":
                await handlePaymentRiskEvent(ctx);
                break;

            default:
                console.log(`[Stripe Webhook] ℹ️ Unhandled event type: ${event.type}`);
        }
    } catch (error) {
        console.error(`[Stripe Webhook] ❌ Error processing ${event.type}:`, error);
    }

    console.log(`[Stripe Webhook] ${timestamp} - Event processing complete\n`);
}

// =============================================================================
// CHECKOUT HANDLERS
// =============================================================================

async function handleCheckoutCompleted(ctx: WebhookContext) {
    const session = ctx.event.data.object as Stripe.Checkout.Session;

    // Handle one-time trial purchase (mode=payment)
    if (session.mode === "payment" && session.metadata?.plan === "trial") {
        await handleTrialPurchase(ctx, session);
    }
}

async function handleTrialPurchase(ctx: WebhookContext, session: Stripe.Checkout.Session) {
    const referenceId = session.metadata?.referenceId || session.client_reference_id;
    const userId = session.metadata?.userId;

    if (!referenceId) {
        console.error("[Stripe Webhook] Missing referenceId for trial checkout.session.completed");
        return;
    }

    // Check if already processed
    const existing = await db.query.subscription.findFirst({
        where: eq(subscriptionTable.stripeSubscriptionId, session.id),
    });

    if (existing) {
        console.log(`[Stripe Webhook] Trial session already processed: ${session.id}`);
        return;
    }

    // Create trial subscription record
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const insertedRows = await db
        .insert(subscriptionTable)
        .values({
            id: generateId(),
            plan: "trial",
            referenceId,
            stripeCustomerId: session.customer as string || null,
            stripeSubscriptionId: session.id,
            status: "active",
            periodStart: now,
            periodEnd: trialEnd,
            trialStart: now,
            trialEnd,
            cancelAtPeriodEnd: true,
            seats: null,
        })
        .returning();

    const insertedRow = insertedRows[0];
    console.log(`[Stripe Webhook] ✅ Created trial access record: ${insertedRow?.id}`);

    // Grant credits
    const creditUserId = userId || await getOrgOwnerId(referenceId);
    if (creditUserId) {
        await grantPlanCredits({
            organizationId: referenceId,
            userId: creditUserId,
            plan: "trial",
            subscriptionId: insertedRow?.id,
            metadata: {
                checkoutSessionId: session.id,
                stripeEventId: ctx.event.id,
                stripeEventType: ctx.event.type,
                stripeCustomerId: session.customer,
                stripePaymentIntentId: session.payment_intent,
            },
        });

        // Track event
        trackSubscriptionEvent("trial_purchase_completed", referenceId, creditUserId, {
            subscription_id: insertedRow?.id,
            stripe_checkout_session_id: session.id,
        });
    }
}

async function handleCheckoutExpired(ctx: WebhookContext) {
    const session = ctx.event.data.object as Stripe.Checkout.Session;

    trackSubscriptionEvent("checkout_session_expired",
        session.metadata?.referenceId || session.client_reference_id,
        session.metadata?.userId || "stripe_webhook",
        {
            plan: session.metadata?.plan,
            stripe_checkout_session_id: session.id,
        }
    );
}

// =============================================================================
// SUBSCRIPTION HANDLERS
// =============================================================================

async function handleSubscriptionUpdated(ctx: WebhookContext) {
    const stripeSubscription = ctx.event.data.object as any;
    console.log(`[Stripe Webhook] Processing subscription ${stripeSubscription.id}, status: ${stripeSubscription.status}`);

    const result = await db
        .update(subscriptionTable)
        .set({
            stripeSubscriptionId: stripeSubscription.id,
            status: stripeSubscription.status,
            periodStart: stripeSubscription.current_period_start
                ? new Date(stripeSubscription.current_period_start * 1000)
                : null,
            periodEnd: stripeSubscription.current_period_end
                ? new Date(stripeSubscription.current_period_end * 1000)
                : null,
            trialStart: stripeSubscription.trial_start
                ? new Date(stripeSubscription.trial_start * 1000)
                : null,
            trialEnd: stripeSubscription.trial_end
                ? new Date(stripeSubscription.trial_end * 1000)
                : null,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
        })
        .where(eq(subscriptionTable.stripeCustomerId, stripeSubscription.customer as string))
        .returning();

    console.log(`[Stripe Webhook] ✅ Updated subscription record: ${result[0]?.id}`);

    // Handle inactive subscription - revoke credits
    const inactiveStatuses = ["canceled", "unpaid", "incomplete_expired"];
    if (result[0] && inactiveStatuses.includes(stripeSubscription.status)) {
        await revokeCreditsForInactiveSubscription(result[0], ctx.event);
    }

    // Track event
    if (result[0]) {
        trackSubscriptionEvent("stripe_subscription_event", result[0].referenceId, "stripe_webhook", {
            internal_subscription_id: result[0].id,
            plan: result[0].plan,
            status: stripeSubscription.status,
            stripe_subscription_id: stripeSubscription.id,
            cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        });
    }
}

async function handleSubscriptionDeleted(ctx: WebhookContext) {
    const stripeSubscription = ctx.event.data.object as any;
    console.log(`[Stripe Webhook] Subscription deleted: ${stripeSubscription.id}`);

    const result = await db
        .update(subscriptionTable)
        .set({
            status: "canceled",
            cancelAtPeriodEnd: false,
        })
        .where(eq(subscriptionTable.stripeSubscriptionId, stripeSubscription.id))
        .returning();

    console.log(`[Stripe Webhook] ✅ Marked subscription as canceled: ${result[0]?.id}`);

    if (result[0]) {
        await revokeCreditsForInactiveSubscription(result[0], ctx.event);
    }
}

// =============================================================================
// INVOICE HANDLERS
// =============================================================================

async function handleInvoicePaymentSucceeded(ctx: WebhookContext) {
    const invoice = ctx.event.data.object as any;
    console.log(`[Stripe Webhook] Payment succeeded for invoice ${invoice.id}`);

    const result = await db
        .update(subscriptionTable)
        .set({ status: "active" })
        .where(eq(subscriptionTable.stripeCustomerId, invoice.customer as string))
        .returning();

    console.log(`[Stripe Webhook] ✅ Marked subscription as active: ${result[0]?.id}`);

    // Grant credits for subscription renewal
    if (result[0]) {
        const subscriptionRecord = result[0];
        const ownerId = await getOrgOwnerId(subscriptionRecord.referenceId);

        if (ownerId) {
            await grantPlanCredits({
                organizationId: subscriptionRecord.referenceId,
                userId: ownerId,
                plan: subscriptionRecord.plan,
                subscriptionId: subscriptionRecord.id,
                resetBalance: true,
                metadata: {
                    invoiceId: invoice.id,
                    stripeEventId: ctx.event.id,
                    stripeEventType: ctx.event.type,
                    stripeCustomerId: invoice.customer,
                    stripeSubscriptionId: invoice.subscription,
                },
            });

            trackSubscriptionEvent("subscription_invoice_paid", subscriptionRecord.referenceId, ownerId, {
                internal_subscription_id: subscriptionRecord.id,
                plan: subscriptionRecord.plan,
                stripe_invoice_id: invoice.id,
            });
        }
    }
}

async function handleInvoicePaymentFailed(ctx: WebhookContext) {
    const invoice = ctx.event.data.object as any;
    console.log(`[Stripe Webhook] ⚠️ Payment failed for invoice ${invoice.id}`);

    const result = await db
        .update(subscriptionTable)
        .set({ status: "past_due" })
        .where(eq(subscriptionTable.stripeCustomerId, invoice.customer as string))
        .returning();

    console.log(`[Stripe Webhook] ✅ Marked subscription as past_due: ${result[0]?.id}`);

    if (result[0]) {
        await revokeCreditsForInactiveSubscription(result[0], ctx.event);
    }
}

// =============================================================================
// PAYMENT RISK HANDLERS
// =============================================================================

async function handlePaymentRiskEvent(ctx: WebhookContext) {
    const obj = ctx.event.data.object as any;

    // Track risk event
    try {
        const posthog = getPostHogServer();
        posthog.capture({
            distinctId: "stripe_webhook",
            event: "stripe_payment_risk_event",
            properties: {
                stripe_event_id: ctx.event.id,
                stripe_event_type: ctx.event.type,
                stripe_charge_id: obj?.charge || obj?.id,
                stripe_customer_id: obj?.customer,
                amount: obj?.amount,
                currency: obj?.currency,
                reason: obj?.reason,
                status: obj?.status,
            },
        });
    } catch (e) {
        console.error("[PostHog] Failed to capture stripe_payment_risk_event", e);
    }

    // Revoke trial for refund/dispute
    await handleTrialRevocation(ctx, obj);
}

async function handleTrialRevocation(ctx: WebhookContext, obj: any) {
    try {
        const chargeId = obj?.charge || (ctx.event.type === "charge.refunded" ? obj?.id : undefined);
        if (!chargeId) return;

        // Find checkout session for this charge
        const sessions = await ctx.stripeClient.checkout.sessions.list({
            payment_intent: chargeId,
            limit: 1,
        });

        const session = sessions?.data?.[0];
        if (!session || session.mode !== "payment" || session.metadata?.plan !== "trial") return;

        const referenceId = session.metadata?.referenceId || session.client_reference_id;
        if (!referenceId) return;

        // Find and cancel trial subscription
        const trialSub = await db.query.subscription.findFirst({
            where: eq(subscriptionTable.stripeSubscriptionId, session.id),
        });

        if (!trialSub) return;

        await db
            .update(subscriptionTable)
            .set({
                status: "canceled",
                cancelAtPeriodEnd: false,
                periodEnd: new Date(),
            })
            .where(eq(subscriptionTable.id, trialSub.id));

        // Revoke credits
        const ownerId = await getOrgOwnerId(referenceId);
        if (ownerId) {
            await revokeCredits({
                organizationId: referenceId,
                userId: ownerId,
                subscriptionId: trialSub.id,
                reason: `Trial revoked due to ${ctx.event.type}`,
                metadata: {
                    stripeEventId: ctx.event.id,
                    stripeEventType: ctx.event.type,
                    stripeCheckoutSessionId: session.id,
                    stripeChargeId: chargeId,
                },
            });

            trackSubscriptionEvent("trial_revoked", referenceId, ownerId, {
                internal_subscription_id: trialSub.id,
                stripe_checkout_session_id: session.id,
                stripe_charge_id: chargeId,
            });
        }
    } catch (error) {
        console.error(`[Stripe Webhook] ❌ Error handling trial revocation:`, error);
    }
}

// =============================================================================
// HELPERS
// =============================================================================

async function getOrgOwnerId(organizationId: string): Promise<string | null> {
    const orgOwner = await db.query.member.findFirst({
        where: eq(member.organizationId, organizationId),
    });
    return orgOwner?.userId || null;
}

async function revokeCreditsForInactiveSubscription(
    subscriptionRecord: typeof subscriptionTable.$inferSelect,
    event: StripeEvent
) {
    const ownerId = await getOrgOwnerId(subscriptionRecord.referenceId);
    if (!ownerId) return;

    await revokeCredits({
        organizationId: subscriptionRecord.referenceId,
        userId: ownerId,
        subscriptionId: subscriptionRecord.id,
        reason: `Subscription became inactive (${subscriptionRecord.status})`,
        metadata: {
            plan: subscriptionRecord.plan,
            stripeEventId: event.id,
            stripeEventType: event.type,
        },
    });
}

function trackSubscriptionEvent(
    eventName: string,
    organizationId: string | null | undefined,
    userId: string,
    properties: Record<string, unknown>
) {
    try {
        const posthog = getPostHogServer();
        posthog.capture({
            distinctId: userId,
            event: eventName,
            groups: organizationId ? { organization: organizationId } : undefined,
            properties: {
                organization_id: organizationId,
                ...properties,
            },
        });
    } catch (e) {
        console.error(`[PostHog] Failed to capture ${eventName}`, e);
    }
}
