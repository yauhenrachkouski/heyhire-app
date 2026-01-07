import Stripe from "stripe";
import { db } from "@/db/drizzle";
import { subscription as subscriptionTable, member, creditTransactions, organization, user, stripeWebhookEvents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPostHogServer } from "@/lib/posthog/posthog-server";
import { generateId } from "@/lib/id";
import { log } from "@/lib/axiom/server";
import { getPlanCreditAllocation, CREDIT_TYPES } from "@/lib/credits";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import {
    PaymentFailedEmail,
    TrialEndingSoonEmail,
} from "@/emails";

const source = "stripe-webhook";

const resend = new Resend(process.env.RESEND_API_KEY);

interface WebhookContext {
    stripeClient: Stripe;
    event: Stripe.Event;
}

function requireReferenceIdFromMetadata(metadata: Record<string, string> | null | undefined): string | null {
    const referenceId = metadata?.referenceId;
    if (!referenceId) return null;
    return referenceId;
}

// Extended type for subscription with period fields
interface StripeSubscriptionExtended extends Stripe.Subscription {
    current_period_start?: number;
    current_period_end?: number;
}

function getPlanNameFromStripeSubscription(sub: Stripe.Subscription): string {
    const priceId = sub.items.data[0]?.price?.id;

    if (priceId && process.env.STRIPE_PRO_PRICE_ID && priceId === process.env.STRIPE_PRO_PRICE_ID) {
        return "pro";
    }

    // Fallback for legacy data
    return "pro";
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

async function isStripeEventProcessed(eventId: string): Promise<boolean> {
    const existing = await db.query.stripeWebhookEvents.findFirst({
        where: eq(stripeWebhookEvents.stripeEventId, eventId),
    });
    return !!existing;
}

async function isBillingActionProcessed(key: string): Promise<boolean> {
    const existing = await db.query.stripeWebhookEvents.findFirst({
        where: eq(stripeWebhookEvents.stripeEventId, key),
    });
    return !!existing;
}

async function markBillingActionProcessed(params: {
    key: string;
    type: string;
    referenceId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
}) {
    try {
        await db.insert(stripeWebhookEvents).values({
            id: generateId(),
            stripeEventId: params.key,
            stripeEventType: params.type,
            referenceId: params.referenceId ?? null,
            stripeCustomerId: params.stripeCustomerId ?? null,
            stripeSubscriptionId: params.stripeSubscriptionId ?? null,
        });
    } catch (e) {
        log.info("billing.action_duplicate", { source, key: params.key, error: String(e) });
    }
}

async function markStripeEventProcessed(params: {
    event: Stripe.Event;
    referenceId?: string | null;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
}) {
    try {
        await db.insert(stripeWebhookEvents).values({
            id: generateId(),
            stripeEventId: params.event.id,
            stripeEventType: params.event.type,
            referenceId: params.referenceId ?? null,
            stripeCustomerId: params.stripeCustomerId ?? null,
            stripeSubscriptionId: params.stripeSubscriptionId ?? null,
        });
    } catch (e) {
        // Idempotency: unique index on stripe_event_id
        log.info("stripe.event_duplicate", { eventId: params.event.id, error: String(e) });
    }
}

/**
 * Main Stripe webhook event handler with idempotency
 */
export async function handleStripeEvent(event: Stripe.Event, stripeClient: Stripe) {
    const eventContext = { eventId: event.id, eventType: event.type };
    log.info("webhook.received", { source, ...eventContext });

    // Note: We don't track webhook_received here - we track specific events with proper user context

    const ctx: WebhookContext = { stripeClient, event };

    try {
        switch (event.type) {
            // NOTE: Better Auth Stripe plugin already handles checkout + subscription state sync.
            // We only handle additional side-effects here (credits, emails, analytics).
            case "customer.subscription.trial_will_end":
                await handleTrialWillEnd(ctx);
                break;

            // Invoice events
            case "invoice.payment_succeeded":
                await handleInvoicePaymentSucceeded(ctx);
                break;
            case "invoice.payment_failed":
                await handleInvoicePaymentFailed(ctx);
                break;
            case "invoice.upcoming":
                await handleInvoiceUpcoming(ctx);
                break;

            // Customer events
            case "customer.updated":
                await handleCustomerUpdated(ctx);
                break;

            // Payment risk events
            case "charge.refunded":
            case "charge.dispute.created":
                await handlePaymentRiskEvent(ctx);
                break;

            default:
                log.info("webhook.unhandled", { source, ...eventContext });
        }
    } catch (error) {
        log.error("webhook.error", { source, ...eventContext, error: String(error) });
        throw error; // Re-throw so Stripe knows to retry
    }

    log.info("webhook.completed", { source, ...eventContext });
}

async function handleTrialWillEnd(ctx: WebhookContext) {
    if (!isSubscriptionEvent(ctx.event)) return;
    const sub = ctx.event.data.object;

    if (await isStripeEventProcessed(ctx.event.id)) {
        log.info("trial_will_end.duplicate", { source, eventId: ctx.event.id });
        return;
    }

    const referenceId = requireReferenceIdFromMetadata(sub.metadata);
    if (!referenceId) {
        log.warn("trial_will_end.missing_reference", { source, eventId: ctx.event.id, stripeSubscriptionId: sub.id });
        return;
    }

    const ownerId = await getOrgOwnerId(referenceId);
    if (!ownerId) {
        log.warn("trial_will_end.no_owner", { source, eventId: ctx.event.id, referenceId });
        return;
    }

    const posthog = getPostHogServer();
    posthog.capture({
        distinctId: ownerId,
        event: "trial_will_end",
        groups: { organization: referenceId },
        properties: {
            organization_id: referenceId,
            stripe_subscription_id: sub.id,
            trial_end: sub.trial_end,
        },
    });

    try {
        const ownerUser = await db.query.user.findFirst({
            where: eq(user.id, ownerId),
            columns: { email: true },
        });
        if (!ownerUser?.email) return;

        const trialEndDate = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
        const trialEndsAtLabel = trialEndDate ? trialEndDate.toLocaleDateString() : "soon";

        const orgRecord = await db.query.organization.findFirst({
            where: eq(organization.id, referenceId),
            columns: { name: true },
        });

        const emailContent = TrialEndingSoonEmail({
            organizationName: orgRecord?.name || referenceId,
            trialEndsAtLabel,
            ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/billing`,
        });

        await resend.emails.send({
            from: process.env.EMAIL_FROM as string,
            to: ownerUser.email,
            subject: "Your Heyhire trial is ending soon",
            react: emailContent,
        });

        await markStripeEventProcessed({
            event: ctx.event,
            referenceId,
            stripeCustomerId: sub.customer as string,
            stripeSubscriptionId: sub.id,
        });
    } catch (e) {
        log.warn("trial_will_end.email_failed", { source, eventId: ctx.event.id, error: String(e) });
    }
}

async function handleInvoiceUpcoming(ctx: WebhookContext) {
    if (!isInvoiceEvent(ctx.event)) return;
    const invoice = ctx.event.data.object;

    const invoiceSubscriptionId = typeof (invoice as any).subscription === "string" ? (invoice as any).subscription : null;
    if (!invoiceSubscriptionId) {
        log.warn("invoice_upcoming.missing_subscription", { source, eventId: ctx.event.id, invoiceId: invoice.id });
        return;
    }

    const stripeSub = await ctx.stripeClient.subscriptions.retrieve(invoiceSubscriptionId);
    const referenceId = requireReferenceIdFromMetadata(stripeSub.metadata);
    if (!referenceId) {
        log.warn("invoice_upcoming.missing_reference", { source, eventId: ctx.event.id, invoiceId: invoice.id, stripeSubscriptionId: invoiceSubscriptionId });
        return;
    }

    const ownerId = await getOrgOwnerId(referenceId);
    if (!ownerId) {
        log.warn("invoice_upcoming.no_owner", { source, eventId: ctx.event.id, referenceId });
        return;
    }

    const posthog = getPostHogServer();
    posthog.capture({
        distinctId: ownerId,
        event: "invoice_upcoming",
        groups: { organization: referenceId },
        properties: {
            organization_id: referenceId,
            stripe_invoice_id: invoice.id,
            stripe_customer_id: invoice.customer as string,
            amount_due: (invoice as any).amount_due,
            next_payment_attempt: (invoice as any).next_payment_attempt,
        },
    });
}

async function handleCustomerUpdated(ctx: WebhookContext) {
    const customer = ctx.event.data.object as Stripe.Customer;

    // Find org/user from stripe customer ID
    const subscriptionRecord = await db.query.subscription.findFirst({
        where: eq(subscriptionTable.stripeCustomerId, customer.id),
    });

    if (!subscriptionRecord?.referenceId) {
        log.warn("customer_updated.no_subscription", {
            source,
            eventId: ctx.event.id,
            stripeCustomerId: customer.id
        });
        return;
    }

    const referenceId = subscriptionRecord.referenceId;
    const ownerId = await getOrgOwnerId(referenceId);

    if (!ownerId) {
        log.warn("customer_updated.no_owner", { source, eventId: ctx.event.id, referenceId });
        return;
    }

    const posthog = getPostHogServer();
    posthog.capture({
        distinctId: ownerId,
        event: "customer_updated",
        groups: { organization: referenceId },
        properties: {
            organization_id: referenceId,
            stripe_customer_id: customer.id,
            email: customer.email,
        },
    });
}

async function handleInvoicePaymentSucceeded(ctx: WebhookContext) {
    if (!isInvoiceEvent(ctx.event)) return;
    const invoice = ctx.event.data.object;
    const eventContext = { eventId: ctx.event.id, invoiceId: invoice.id };

    // Idempotency check
    if (await isStripeEventProcessed(ctx.event.id)) {
        log.info("invoice_succeeded.duplicate", { source, ...eventContext });
        return;
    }

    log.info("invoice_succeeded.processing", { source, ...eventContext });

    const invoiceSubscriptionId = typeof (invoice as any).subscription === "string" ? (invoice as any).subscription : null;
    if (!invoiceSubscriptionId) {
        log.warn("invoice_succeeded.missing_subscription", {
            source,
            ...eventContext,
            stripeCustomerId: invoice.customer as string,
        });
        return;
    }

    const stripeSub = await ctx.stripeClient.subscriptions.retrieve(invoiceSubscriptionId);
    const referenceId = requireReferenceIdFromMetadata(stripeSub.metadata);
    if (!referenceId) {
        log.warn("invoice_succeeded.missing_reference", { source, ...eventContext, stripeSubscriptionId: invoiceSubscriptionId });
        return;
    }

    const subscriptionRecord = await db.query.subscription.findFirst({
        where: eq(subscriptionTable.referenceId, referenceId),
    });

    if (!subscriptionRecord) {
        log.warn("invoice_succeeded.no_internal_subscription", { source, ...eventContext, referenceId });
        return;
    }
    const ownerId = await getOrgOwnerId(subscriptionRecord.referenceId);

    const periodStart = stripeSub?.items?.data?.[0]?.current_period_start;
    const periodStartKey = periodStart
        ? String(periodStart)
        : subscriptionRecord.periodStart
            ? String(Math.floor(subscriptionRecord.periodStart.getTime() / 1000))
            : "unknown";
    const creditsKey = `better_auth:credits_reset:${subscriptionRecord.id}:${periodStartKey}`;
    const creditsAlreadyGranted = await isBillingActionProcessed(creditsKey);

    if (ownerId && !creditsAlreadyGranted) {
        await grantPlanCreditsWithTransaction(
            subscriptionRecord.referenceId,
            ownerId,
            subscriptionRecord.plan,
            subscriptionRecord.id,
            ctx.event
        );

        await markBillingActionProcessed({
            key: creditsKey,
            type: "credits_reset",
            referenceId,
            stripeCustomerId: stripeSub.customer as string,
            stripeSubscriptionId: stripeSub.id,
        });

        const posthog = getPostHogServer();
        posthog.capture({
            distinctId: ownerId,
            event: "credits_reset",
            groups: { organization: subscriptionRecord.referenceId },
            properties: {
                organization_id: subscriptionRecord.referenceId,
                internal_subscription_id: subscriptionRecord.id,
                plan: subscriptionRecord.plan,
                period_start: periodStartKey,
                stripe_invoice_id: invoice.id,
            },
        });
    }

    if (creditsAlreadyGranted) {
        log.info("credits.already_granted", {
            source,
            referenceId,
            internal_subscription_id: subscriptionRecord.id,
            periodStart: periodStartKey,
        });
    }

    if (ownerId) {
        const posthog = getPostHogServer();
        posthog.capture({
            distinctId: ownerId,
            event: "subscription_invoice_paid",
            groups: { organization: subscriptionRecord.referenceId },
            properties: {
                organization_id: subscriptionRecord.referenceId,
                internal_subscription_id: subscriptionRecord.id,
                plan: subscriptionRecord.plan,
                stripe_invoice_id: invoice.id,
            },
        });
    }

    log.info("invoice_succeeded.completed", { source, ...eventContext, internalId: subscriptionRecord.id });

    revalidatePath(`/${referenceId}`, "layout");
    revalidatePath(`/${referenceId}/billing`);

    await markStripeEventProcessed({
        event: ctx.event,
        referenceId,
        stripeCustomerId: stripeSub.customer as string,
        stripeSubscriptionId: stripeSub.id,
    });
}

async function handleInvoicePaymentFailed(ctx: WebhookContext) {
    if (!isInvoiceEvent(ctx.event)) return;
    const invoice = ctx.event.data.object;
    const eventContext = { eventId: ctx.event.id, invoiceId: invoice.id };

    if (await isStripeEventProcessed(ctx.event.id)) {
        log.info("invoice_failed.duplicate", { source, ...eventContext });
        return;
    }

    log.warn("invoice_failed.processing", { source, ...eventContext });

    const invoiceSubscriptionId = typeof (invoice as any).subscription === "string" ? (invoice as any).subscription : null;
    if (!invoiceSubscriptionId) {
        log.warn("invoice_failed.missing_subscription", {
            source,
            ...eventContext,
            stripeCustomerId: invoice.customer as string,
        });
        return;
    }

    const stripeSub = await ctx.stripeClient.subscriptions.retrieve(invoiceSubscriptionId);
    const referenceId = requireReferenceIdFromMetadata(stripeSub.metadata);
    if (!referenceId) {
        log.warn("invoice_failed.missing_reference", { source, ...eventContext, stripeSubscriptionId: invoiceSubscriptionId });
        return;
    }

    const subscriptionRecord = await db.query.subscription.findFirst({
        where: eq(subscriptionTable.referenceId, referenceId),
    });

    if (subscriptionRecord) {
        log.info("invoice_failed.marked_past_due", { source, ...eventContext, internalId: subscriptionRecord.id });

        const ownerId = await getOrgOwnerId(subscriptionRecord.referenceId);
        if (ownerId) {
            const posthog = getPostHogServer();
            posthog.capture({
                distinctId: ownerId,
                event: "invoice_payment_failed",
                groups: { organization: subscriptionRecord.referenceId },
                properties: {
                    organization_id: subscriptionRecord.referenceId,
                    internal_subscription_id: subscriptionRecord.id,
                    stripe_invoice_id: invoice.id,
                    stripe_subscription_id: invoiceSubscriptionId,
                    plan: subscriptionRecord.plan,
                },
            });
        }

        try {
            if (ownerId) {
                const ownerUser = await db.query.user.findFirst({
                    where: eq(user.id, ownerId),
                    columns: { email: true },
                });
                if (ownerUser?.email) {
                    const orgRecord = await db.query.organization.findFirst({
                        where: eq(organization.id, subscriptionRecord.referenceId),
                        columns: { name: true },
                    });
                    const emailContent = PaymentFailedEmail({
                        organizationName: orgRecord?.name || subscriptionRecord.referenceId,
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
            log.warn("invoice_failed.email_failed", { source, eventId: ctx.event.id, error: String(e) });
        }
    }

    revalidatePath(`/${referenceId}`, "layout");
    revalidatePath(`/${referenceId}/billing`);

    await markStripeEventProcessed({
        event: ctx.event,
        referenceId,
        stripeCustomerId: stripeSub.customer as string,
        stripeSubscriptionId: stripeSub.id,
    });
}

async function handlePaymentRiskEvent(ctx: WebhookContext) {
    const obj = ctx.event.data.object as unknown as Record<string, unknown>;
    const stripeCustomerId = obj?.customer as string | undefined;

    if (!stripeCustomerId) {
        log.warn("payment_risk.missing_customer", { source, eventId: ctx.event.id });
        return;
    }

    // Find org/user from stripe customer ID
    const subscriptionRecord = await db.query.subscription.findFirst({
        where: eq(subscriptionTable.stripeCustomerId, stripeCustomerId),
    });

    if (!subscriptionRecord?.referenceId) {
        log.warn("payment_risk.no_subscription", {
            source,
            eventId: ctx.event.id,
            stripeCustomerId
        });
        return;
    }

    const referenceId = subscriptionRecord.referenceId;
    const ownerId = await getOrgOwnerId(referenceId);

    if (!ownerId) {
        log.warn("payment_risk.no_owner", { source, eventId: ctx.event.id, referenceId });
        return;
    }

    log.warn("payment_risk.received", {
        source,
        eventId: ctx.event.id,
        eventType: ctx.event.type,
        chargeId: obj?.charge || obj?.id,
        organizationId: referenceId,
        userId: ownerId,
    });

    const posthog = getPostHogServer();
    posthog.capture({
        distinctId: ownerId,
        event: "stripe_payment_risk_event",
        groups: { organization: referenceId },
        properties: {
            organization_id: referenceId,
            stripe_charge_id: obj?.charge || obj?.id,
            stripe_customer_id: stripeCustomerId,
            amount: obj?.amount,
            reason: obj?.reason,
        },
    });
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

    return owner?.userId || null;
}

/**
 * Grant credits with transaction for monthly reset
 * Creates two transactions: burn out remaining credits, then grant full plan amount
 */
async function grantPlanCreditsWithTransaction(
    organizationId: string,
    userId: string,
    plan: string,
    subscriptionId: string,
    event: Stripe.Event,
    creditsOverride?: number
) {
    const creditsToGrant = creditsOverride ?? getPlanCreditAllocation(plan);
    if (creditsToGrant <= 0) return;

    let burnedCredits = 0;

    await db.transaction(async (tx) => {
        const org = await tx.query.organization.findFirst({
            where: eq(organization.id, organizationId),
            columns: { credits: true },
        });

        const balanceBefore = org?.credits ?? 0;
        burnedCredits = balanceBefore;

        // Transaction 1: Burn out remaining credits if any
        if (balanceBefore > 0) {
            await tx.insert(creditTransactions).values({
                id: generateId(),
                organizationId,
                userId,
                type: "subscription_grant",
                creditType: CREDIT_TYPES.GENERAL,
                amount: -balanceBefore,
                balanceBefore,
                balanceAfter: 0,
                relatedEntityId: subscriptionId,
                description: `Period reset: ${balanceBefore} unused credits expired`,
                metadata: JSON.stringify({
                    plan,
                    reason: "period_reset_burn",
                    stripeEventId: event.id,
                    stripeEventType: event.type,
                }),
            });
        }

        // Transaction 2: Grant full plan credits
        await tx
            .update(organization)
            .set({ credits: creditsToGrant })
            .where(eq(organization.id, organizationId));

        await tx.insert(creditTransactions).values({
            id: generateId(),
            organizationId,
            userId,
            type: "subscription_grant",
            creditType: CREDIT_TYPES.GENERAL,
            amount: creditsToGrant,
            balanceBefore: 0,
            balanceAfter: creditsToGrant,
            relatedEntityId: subscriptionId,
            description: `Monthly allocation: ${creditsToGrant} credits for ${plan} plan`,
            metadata: JSON.stringify({
                plan,
                reason: "period_reset_grant",
                stripeEventId: event.id,
                stripeEventType: event.type,
            }),
        });
    });

    log.info("credits.granted", { source, organizationId, plan, credits: creditsToGrant, burnedOut: burnedCredits });
}
