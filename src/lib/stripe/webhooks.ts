import Stripe from "stripe";
import { db } from "@/db/drizzle";
import { subscription as subscriptionTable, member, creditTransactions, organization, user } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { trackServerEvent } from "@/lib/posthog/track";
import { generateId } from "@/lib/id";
import { logger } from "@/lib/axiom/server";
import { getPlanCreditAllocation, CREDIT_TYPES } from "@/lib/credits";
import { shouldRevokeCredits, isActive, type SubscriptionStatus } from "./state-machine";
import { Resend } from "resend";
import {
    PaymentFailedEmail,
    SubscriptionActivatedEmail,
    SubscriptionCanceledEmail,
    SubscriptionPlanChangedEmail,
    TrialStartedEmail,
} from "@/emails";

const log = logger.with({ service: "stripe-webhook" });

const resend = new Resend(process.env.RESEND_API_KEY);

interface WebhookContext {
    stripeClient: Stripe;
    event: Stripe.Event;
}

// Type guards for Stripe events
function isCheckoutSessionEvent(
    event: Stripe.Event
): event is Stripe.Event & { data: { object: Stripe.Checkout.Session } } {
    return event.type.startsWith("checkout.session.");
}

// Extended type for subscription with period fields
interface StripeSubscriptionExtended extends Stripe.Subscription {
    current_period_start?: number;
    current_period_end?: number;
}

function getPlanNameFromStripeSubscription(sub: Stripe.Subscription): string {
    const priceId = sub.items.data[0]?.price?.id;

    if (priceId && process.env.STRIPE_TRIAL_PRICE_ID && priceId === process.env.STRIPE_TRIAL_PRICE_ID) {
        return "trial";
    }

    // Default paid plan (current app has a single paid plan)
    return "standard";
}

function isSubscriptionEvent(
    event: Stripe.Event
): event is Stripe.Event & { data: { object: StripeSubscriptionExtended } } {
    return event.type.startsWith("customer.subscription.");
}

function isInvoiceEvent(
    event: Stripe.Event
): event is Stripe.Event & { data: { object: Stripe.Invoice } } {
    return event.type.startsWith("invoice.");
}

/**
 * Check if event was already processed
 * Uses subscription.stripeSubscriptionId + metadata to track processed events
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
    // Check credit_transactions metadata for this event ID
    const existing = await db.query.creditTransactions.findFirst({
        where: sql`${creditTransactions.metadata}::jsonb->>'stripeEventId' = ${eventId}`,
    });
    return !!existing;
}

/**
 * Main Stripe webhook event handler with idempotency
 */
export async function handleStripeEvent(event: Stripe.Event, stripeClient: Stripe) {
    const eventContext = { eventId: event.id, eventType: event.type };
    log.info("Webhook received", eventContext);

    // Track webhook received
    try {
        trackServerEvent("stripe_webhook", "stripe_webhook_received", undefined, {
            stripe_event_id: event.id,
            stripe_event_type: event.type,
        });
    } catch (e) {
        log.warn("Failed to track webhook", { ...eventContext, error: String(e) });
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
                log.info("Unhandled event type", eventContext);
        }
    } catch (error) {
        log.error("Event processing failed", { ...eventContext, error: String(error) });
        throw error; // Re-throw so Stripe knows to retry
    }

    log.info("Event processing complete", eventContext);
}

async function handleCheckoutCompleted(ctx: WebhookContext) {
    if (!isCheckoutSessionEvent(ctx.event)) return;
    const session = ctx.event.data.object;

    // Handle one-time trial purchase (mode=payment)
    if (session.mode === "payment" && session.metadata?.plan === "trial") {
        await handleTrialPurchase(ctx, session);
    }
}

async function handleTrialPurchase(ctx: WebhookContext, session: Stripe.Checkout.Session) {
    const referenceId = session.metadata?.referenceId || session.client_reference_id;
    const userId = session.metadata?.userId;
    const eventContext = { eventId: ctx.event.id, sessionId: session.id, referenceId };

    if (!referenceId) {
        log.error("Missing referenceId for trial purchase", eventContext);
        return;
    }

    // Idempotency check
    const existing = await db.query.subscription.findFirst({
        where: eq(subscriptionTable.stripeSubscriptionId, session.id),
    });

    if (existing) {
        log.info("Trial session already processed", eventContext);
        return;
    }

    // Use transaction for atomicity
    const result = await db.transaction(async (tx) => {
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const subscriptionId = generateId();

        // 1. Create subscription record
        await tx.insert(subscriptionTable).values({
            id: subscriptionId,
            plan: "trial",
            referenceId,
            stripeCustomerId: (session.customer as string) || null,
            stripeSubscriptionId: session.id,
            status: "active",
            periodStart: now,
            periodEnd: trialEnd,
            trialStart: now,
            trialEnd,
            cancelAtPeriodEnd: true,
            seats: null,
        });

        // 2. Get org owner (correctly!)
        const ownerId = userId || await getOrgOwnerId(referenceId);
        if (!ownerId) {
            log.warn("No owner found for credits", { ...eventContext, subscriptionId });
            return { subscriptionId, creditsGranted: false };
        }

        // 3. Get current balance and grant credits
        const org = await tx.query.organization.findFirst({
            where: eq(organization.id, referenceId),
            columns: { credits: true },
        });

        const creditsToGrant = getPlanCreditAllocation("trial", CREDIT_TYPES.CONTACT_LOOKUP);
        const balanceBefore = org?.credits ?? 0;
        const balanceAfter = balanceBefore + creditsToGrant;

        // 4. Update organization credits
        await tx
            .update(organization)
            .set({ credits: balanceAfter })
            .where(eq(organization.id, referenceId));

        // 5. Record credit transaction
        await tx.insert(creditTransactions).values({
            id: generateId(),
            organizationId: referenceId,
            userId: ownerId,
            type: "subscription_grant",
            creditType: CREDIT_TYPES.CONTACT_LOOKUP,
            amount: creditsToGrant,
            balanceBefore,
            balanceAfter,
            relatedEntityId: subscriptionId,
            description: `Trial purchase: ${creditsToGrant} contact lookup credits`,
            metadata: JSON.stringify({
                plan: "trial",
                stripeEventId: ctx.event.id,
                stripeEventType: ctx.event.type,
                checkoutSessionId: session.id,
                stripeCustomerId: session.customer,
            }),
        });

        return { subscriptionId, creditsGranted: true, creditsAmount: creditsToGrant, ownerId };
    });

    log.info("Trial purchase processed", { ...eventContext, ...result });

    // Track after transaction succeeds
    if (result.creditsGranted && result.ownerId) {
        trackServerEvent(result.ownerId, "trial_purchase_completed", referenceId, {
            subscription_id: result.subscriptionId,
            credits_granted: result.creditsAmount,
            stripe_checkout_session_id: session.id,
        });

        try {
            const ownerUser = await db.query.user.findFirst({
                where: eq(user.id, result.ownerId),
                columns: { email: true },
            });

            if (ownerUser?.email) {
                const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                const emailContent = TrialStartedEmail({
                    organizationName: referenceId,
                    trialEndsAtLabel: trialEnd.toLocaleDateString(),
                    ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`,
                });
                await resend.emails.send({
                    from: process.env.EMAIL_FROM as string,
                    to: ownerUser.email,
                    subject: "Your Heyhire trial has started",
                    react: emailContent,
                });
            }
        } catch (e) {
            log.warn("Failed to send trial started email", { eventId: ctx.event.id, error: String(e) });
        }
    }
}

async function handleCheckoutExpired(ctx: WebhookContext) {
    if (!isCheckoutSessionEvent(ctx.event)) return;
    const session = ctx.event.data.object;

    trackServerEvent(
        session.metadata?.userId || "stripe_webhook",
        "checkout_session_expired",
        session.metadata?.referenceId || session.client_reference_id || undefined,
        { plan: session.metadata?.plan, stripe_checkout_session_id: session.id }
    );
}

async function handleSubscriptionUpdated(ctx: WebhookContext) {
    if (!isSubscriptionEvent(ctx.event)) return;
    const sub = ctx.event.data.object;
    const eventContext = { eventId: ctx.event.id, subscriptionId: sub.id, status: sub.status };

    log.info("Processing subscription update", eventContext);

    const existing = await db.query.subscription.findFirst({
        where: eq(subscriptionTable.stripeCustomerId, sub.customer as string),
    });

    if (!existing) {
        log.warn("No subscription found to update", eventContext);
        return;
    }

    const newPlan = getPlanNameFromStripeSubscription(sub);

    const result = await db
        .update(subscriptionTable)
        .set({
            stripeSubscriptionId: sub.id,
            status: sub.status,
            plan: newPlan,
            periodStart: sub.current_period_start ? new Date(sub.current_period_start * 1000) : null,
            periodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
            trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
            trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end || false,
        })
        .where(eq(subscriptionTable.stripeCustomerId, sub.customer as string))
        .returning();

    log.info("Subscription updated", { ...eventContext, internalId: result[0].id });

    if (existing.plan && existing.plan !== newPlan) {
        try {
            const ownerId = await getOrgOwnerId(result[0].referenceId);
            if (ownerId) {
                const ownerUser = await db.query.user.findFirst({
                    where: eq(user.id, ownerId),
                    columns: { email: true },
                });

                if (ownerUser?.email) {
                    const orgRecord = await db.query.organization.findFirst({
                        where: eq(organization.id, result[0].referenceId),
                        columns: { name: true },
                    });

                    const emailContent = SubscriptionPlanChangedEmail({
                        organizationName: orgRecord?.name || result[0].referenceId,
                        previousPlanName: existing.plan,
                        newPlanName: newPlan,
                        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`,
                    });

                    await resend.emails.send({
                        from: process.env.EMAIL_FROM as string,
                        to: ownerUser.email,
                        subject: "Your Heyhire plan was updated",
                        react: emailContent,
                    });
                }
            }
        } catch (e) {
            log.warn("Failed to send subscription plan changed email", { eventId: ctx.event.id, error: String(e) });
        }
    }

    // Revoke credits if subscription became inactive
    if (shouldRevokeCredits(sub.status as SubscriptionStatus)) {
        await revokeCreditsForSubscription(result[0], ctx.event);
    }

    trackServerEvent("stripe_webhook", "subscription_updated", result[0].referenceId, {
        internal_subscription_id: result[0].id,
        status: sub.status,
        stripe_subscription_id: sub.id,
    });
}

async function handleSubscriptionDeleted(ctx: WebhookContext) {
    if (!isSubscriptionEvent(ctx.event)) return;
    const sub = ctx.event.data.object;
    const eventContext = { eventId: ctx.event.id, subscriptionId: sub.id };

    log.info("Processing subscription deletion", eventContext);

    const result = await db
        .update(subscriptionTable)
        .set({ status: "canceled", cancelAtPeriodEnd: false })
        .where(eq(subscriptionTable.stripeSubscriptionId, sub.id))
        .returning();

    if (result[0]) {
        await revokeCreditsForSubscription(result[0], ctx.event);
        log.info("Subscription canceled", { ...eventContext, internalId: result[0].id });

        try {
            const ownerId = await getOrgOwnerId(result[0].referenceId);
            if (ownerId) {
                const ownerUser = await db.query.user.findFirst({
                    where: eq(user.id, ownerId),
                    columns: { email: true },
                });
                if (ownerUser?.email) {
                    const orgRecord = await db.query.organization.findFirst({
                        where: eq(organization.id, result[0].referenceId),
                        columns: { name: true },
                    });
                    const emailContent = SubscriptionCanceledEmail({
                        organizationName: orgRecord?.name || result[0].referenceId,
                        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`,
                    });
                    await resend.emails.send({
                        from: process.env.EMAIL_FROM as string,
                        to: ownerUser.email,
                        subject: "Your Heyhire subscription was canceled",
                        react: emailContent,
                    });
                }
            }
        } catch (e) {
            log.warn("Failed to send subscription canceled email", { eventId: ctx.event.id, error: String(e) });
        }
    }
}

async function handleInvoicePaymentSucceeded(ctx: WebhookContext) {
    if (!isInvoiceEvent(ctx.event)) return;
    const invoice = ctx.event.data.object;
    const eventContext = { eventId: ctx.event.id, invoiceId: invoice.id };

    // Idempotency check
    if (await isEventProcessed(ctx.event.id)) {
        log.info("Invoice event already processed", eventContext);
        return;
    }

    log.info("Processing successful payment", eventContext);

    const result = await db
        .update(subscriptionTable)
        .set({ status: "active" })
        .where(eq(subscriptionTable.stripeCustomerId, invoice.customer as string))
        .returning();

    if (!result[0]) {
        log.warn("No subscription found for invoice", eventContext);
        return;
    }

    const subscriptionRecord = result[0];
    const ownerId = await getOrgOwnerId(subscriptionRecord.referenceId);

    if (ownerId) {
        await grantPlanCreditsWithTransaction(
            subscriptionRecord.referenceId,
            ownerId,
            subscriptionRecord.plan,
            subscriptionRecord.id,
            ctx.event
        );

        trackServerEvent(ownerId, "subscription_invoice_paid", subscriptionRecord.referenceId, {
            internal_subscription_id: subscriptionRecord.id,
            plan: subscriptionRecord.plan,
            stripe_invoice_id: invoice.id,
        });
    }

    log.info("Invoice processed", { ...eventContext, internalId: subscriptionRecord.id });

    try {
        const ownerUser = ownerId
            ? await db.query.user.findFirst({
                  where: eq(user.id, ownerId),
                  columns: { email: true },
              })
            : null;

        if (ownerUser?.email) {
            const orgRecord = await db.query.organization.findFirst({
                where: eq(organization.id, subscriptionRecord.referenceId),
                columns: { name: true },
            });

            const emailContent = SubscriptionActivatedEmail({
                organizationName: orgRecord?.name || subscriptionRecord.referenceId,
                planName: subscriptionRecord.plan,
                ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`,
            });
            await resend.emails.send({
                from: process.env.EMAIL_FROM as string,
                to: ownerUser.email,
                subject: "Your Heyhire subscription is active",
                react: emailContent,
            });
        }
    } catch (e) {
        log.warn("Failed to send subscription activated email", { eventId: ctx.event.id, error: String(e) });
    }
}

async function handleInvoicePaymentFailed(ctx: WebhookContext) {
    if (!isInvoiceEvent(ctx.event)) return;
    const invoice = ctx.event.data.object;
    const eventContext = { eventId: ctx.event.id, invoiceId: invoice.id };

    log.warn("Processing failed payment", eventContext);

    const result = await db
        .update(subscriptionTable)
        .set({ status: "past_due" })
        .where(eq(subscriptionTable.stripeCustomerId, invoice.customer as string))
        .returning();

    if (result[0]) {
        await revokeCreditsForSubscription(result[0], ctx.event);
        log.info("Subscription marked past_due", { ...eventContext, internalId: result[0].id });

        try {
            const ownerId = await getOrgOwnerId(result[0].referenceId);
            if (ownerId) {
                const ownerUser = await db.query.user.findFirst({
                    where: eq(user.id, ownerId),
                    columns: { email: true },
                });
                if (ownerUser?.email) {
                    const orgRecord = await db.query.organization.findFirst({
                        where: eq(organization.id, result[0].referenceId),
                        columns: { name: true },
                    });
                    const emailContent = PaymentFailedEmail({
                        organizationName: orgRecord?.name || result[0].referenceId,
                        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`,
                    });
                    await resend.emails.send({
                        from: process.env.EMAIL_FROM as string,
                        to: ownerUser.email,
                        subject: "Payment failed — action required",
                        react: emailContent,
                    });
                }
            }
        } catch (e) {
            log.warn("Failed to send payment failed email", { eventId: ctx.event.id, error: String(e) });
        }
    }
}

async function handlePaymentRiskEvent(ctx: WebhookContext) {
    const obj = ctx.event.data.object as unknown as Record<string, unknown>;
    const eventContext = {
        eventId: ctx.event.id,
        eventType: ctx.event.type,
        chargeId: obj?.charge || obj?.id,
    };

    log.warn("Payment risk event received", eventContext);

    trackServerEvent("stripe_webhook", "stripe_payment_risk_event", undefined, {
        stripe_charge_id: obj?.charge || obj?.id,
        stripe_customer_id: obj?.customer,
        amount: obj?.amount,
        reason: obj?.reason,
    });

    // Revoke trial for refund/dispute
    await handleTrialRevocation(ctx, obj);
}

async function handleTrialRevocation(ctx: WebhookContext, obj: Record<string, unknown>) {
    const chargeId = (obj?.charge as string) || (ctx.event.type === "charge.refunded" ? obj?.id as string : undefined);
    if (!chargeId) return;

    try {
        const sessions = await ctx.stripeClient.checkout.sessions.list({
            payment_intent: chargeId,
            limit: 1,
        });

        const session = sessions?.data?.[0];
        if (!session || session.mode !== "payment" || session.metadata?.plan !== "trial") return;

        const referenceId = session.metadata?.referenceId || session.client_reference_id;
        if (!referenceId) return;

        const trialSub = await db.query.subscription.findFirst({
            where: eq(subscriptionTable.stripeSubscriptionId, session.id),
        });

        if (!trialSub) return;

        await db.transaction(async (tx) => {
            // Cancel subscription
            await tx
                .update(subscriptionTable)
                .set({ status: "canceled", cancelAtPeriodEnd: false, periodEnd: new Date() })
                .where(eq(subscriptionTable.id, trialSub.id));

            // Revoke credits
            const ownerId = await getOrgOwnerId(referenceId);
            if (ownerId) {
                await setCreditsToZero(tx, referenceId, ownerId, trialSub.id, ctx.event, "Trial revoked due to " + ctx.event.type);
            }
        });

        log.info("Trial revoked", { eventId: ctx.event.id, subscriptionId: trialSub.id });

        const ownerId = await getOrgOwnerId(referenceId);
        if (ownerId) {
            trackServerEvent(ownerId, "trial_revoked", referenceId, {
                internal_subscription_id: trialSub.id,
                stripe_checkout_session_id: session.id,
            });
        }
    } catch (error) {
        log.error("Trial revocation failed", { eventId: ctx.event.id, error: String(error) });
    }
}

/**
 * Get organization owner ID (NOT just first member)
 */
async function getOrgOwnerId(organizationId: string): Promise<string | null> {
    const owner = await db.query.member.findFirst({
        where: and(
            eq(member.organizationId, organizationId),
            eq(member.role, "owner")
        ),
    });

    // Fallback to first member if no owner found (legacy data)
    if (!owner) {
        const firstMember = await db.query.member.findFirst({
            where: eq(member.organizationId, organizationId),
        });
        return firstMember?.userId || null;
    }

    return owner.userId;
}

/**
 * Grant credits with transaction for monthly reset
 */
async function grantPlanCreditsWithTransaction(
    organizationId: string,
    userId: string,
    plan: string,
    subscriptionId: string,
    event: Stripe.Event
) {
    const creditsToGrant = getPlanCreditAllocation(plan, CREDIT_TYPES.CONTACT_LOOKUP);
    if (creditsToGrant <= 0) return;

    await db.transaction(async (tx) => {
        const org = await tx.query.organization.findFirst({
            where: eq(organization.id, organizationId),
            columns: { credits: true },
        });

        const balanceBefore = org?.credits ?? 0;

        // Monthly reset - set to plan amount, don't add
        await tx
            .update(organization)
            .set({ credits: creditsToGrant })
            .where(eq(organization.id, organizationId));

        await tx.insert(creditTransactions).values({
            id: generateId(),
            organizationId,
            userId,
            type: "subscription_grant",
            creditType: CREDIT_TYPES.CONTACT_LOOKUP,
            amount: creditsToGrant - balanceBefore, // Delta
            balanceBefore,
            balanceAfter: creditsToGrant,
            relatedEntityId: subscriptionId,
            description: `Monthly reset: ${creditsToGrant} credits for ${plan} plan`,
            metadata: JSON.stringify({
                plan,
                stripeEventId: event.id,
                stripeEventType: event.type,
            }),
        });
    });

    log.info("Credits granted", { organizationId, plan, credits: creditsToGrant });
}

/**
 * Revoke credits for inactive subscription
 */
async function revokeCreditsForSubscription(
    subscriptionRecord: typeof subscriptionTable.$inferSelect,
    event: Stripe.Event
) {
    const ownerId = await getOrgOwnerId(subscriptionRecord.referenceId);
    if (!ownerId) return;

    await db.transaction(async (tx) => {
        await setCreditsToZero(
            tx,
            subscriptionRecord.referenceId,
            ownerId,
            subscriptionRecord.id,
            event,
            `Subscription inactive (${subscriptionRecord.status})`
        );
    });
}

/**
 * Set credits to zero with transaction
 */
async function setCreditsToZero(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    organizationId: string,
    userId: string,
    subscriptionId: string,
    event: Stripe.Event,
    reason: string
) {
    const org = await tx.query.organization.findFirst({
        where: eq(organization.id, organizationId),
        columns: { credits: true },
    });

    const balanceBefore = org?.credits ?? 0;
    if (balanceBefore === 0) return; // Already zero

    await tx
        .update(organization)
        .set({ credits: 0 })
        .where(eq(organization.id, organizationId));

    await tx.insert(creditTransactions).values({
        id: generateId(),
        organizationId,
        userId,
        type: "subscription_grant",
        creditType: CREDIT_TYPES.CONTACT_LOOKUP,
        amount: -balanceBefore,
        balanceBefore,
        balanceAfter: 0,
        relatedEntityId: subscriptionId,
        description: reason,
        metadata: JSON.stringify({
            stripeEventId: event.id,
            stripeEventType: event.type,
        }),
    });

    log.info("Credits revoked", { organizationId, reason });
}

/**
 * Track analytics event
 */
 
