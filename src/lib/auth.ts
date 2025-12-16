import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, magicLink, lastLoginMethod } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import { APIError } from "better-auth/api";
import { db } from "@/db/drizzle";
import * as schema from "@/db/schema";
import { Resend } from "resend";
import Stripe from "stripe";
import { DISALLOWED_DOMAINS } from "./constants";
import { getPostHogServer } from "@/lib/posthog/posthog-server";
import { eq } from "drizzle-orm";

// Validate Stripe environment variables at startup
function validateStripeConfig() {
   const requiredVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_ID',
      'STRIPE_TRIAL_PRICE_ID',
   ];

   const missing = requiredVars.filter((varName) => {
      const value = process.env[varName];
      return !value || value.includes('placeholder');
   });

   if (missing.length > 0) {
      const errorMsg = `Missing or invalid Stripe configuration: ${missing.join(', ')}. Please set these environment variables in your .env.local file.`;
      console.error(errorMsg);
      if (process.env.NODE_ENV === 'production') {
         throw new Error(errorMsg);
      }
      // Log warning in development but don't throw
      console.warn('⚠️ Stripe configuration incomplete - some features may not work');
   }
}

// Validate on startup
validateStripeConfig();

const resend = new Resend(process.env.RESEND_API_KEY);

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
   apiVersion: "2025-08-27.basil",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const auth = betterAuth({
   database: drizzleAdapter(db, {
      provider: "pg",
      schema,
   }),
   emailAndPassword: {
      enabled: false,
   },
   trustedOrigins: [
      appUrl,
   ],
   socialProviders: {
      google: {
         clientId: process.env.GOOGLE_CLIENT_ID as string,
         clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
         redirectURI: `${appUrl}/api/auth/callback/google`,
      },
   },
   plugins: [
      organization({
         async sendInvitationEmail(data) {
            const inviteLink = `${appUrl}/auth/accept-invitation/${data.id}`;
            await resend.emails.send({
               from: process.env.EMAIL_FROM as string,
               to: data.email,
               subject: `You've been invited to join ${data.organization.name}`,
               html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                     <h2>You've been invited!</h2>
                     <p>${data.inviter.user.name || data.inviter.user.email} has invited you to join <strong>${data.organization.name}</strong> on Heyhire.</p>
                     <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                        Accept Invitation
                     </a>
                     <p>This invitation will expire in 48 hours.</p>
                     <p>If you didn't expect this invitation, you can safely ignore this email.</p>
                  </div>
               `,
            });
         },
         organizationHooks: {
            afterCreateOrganization: async ({ organization, member, user }) => {
               console.log(`[Organization] Created organization "${organization.name}" (${organization.id}) by user ${user.email}`);
               // TODO: Send welcome email to organization creator
            },
            afterCreateInvitation: async ({ invitation, inviter, organization }) => {
               console.log(`[Invitation] Created invitation ${invitation.id} for ${invitation.email} to org ${organization.id} by ${inviter.email}`);
               try {
                  const posthog = getPostHogServer();
                  posthog.capture({
                     distinctId: inviter.id,
                     event: "invitation_created",
                     properties: {
                        invitationId: invitation.id,
                        organizationId: organization.id,
                        invitedEmail: invitation.email,
                        role: invitation.role,
                        status: invitation.status,
                     },
                  });
               } catch (e) {
                  console.error("[PostHog] Failed to capture invitation_created", e);
               }
            },
            beforeAcceptInvitation: async ({ invitation, user, organization }) => {
               console.log(`[Invitation] User ${user.email} attempting to accept invitation ${invitation.id} for org ${organization.id}`);
               try {
                  const posthog = getPostHogServer();
                  posthog.capture({
                     distinctId: user.id,
                     event: "invitation_accept_attempted",
                     properties: {
                        invitationId: invitation.id,
                        organizationId: organization.id,
                        invitedEmail: invitation.email,
                        role: invitation.role,
                        invitationStatus: invitation.status,
                     },
                  });
               } catch (e) {
                  console.error("[PostHog] Failed to capture invitation_accept_attempted", e);
               }
            },
            afterAcceptInvitation: async ({ invitation, member, user, organization }) => {
               console.log(`[Invitation] ✅ Accepted invitation ${invitation.id}. User ${user.email} is now member ${member.id} of org ${organization.id}`);
               try {
                  const posthog = getPostHogServer();
                  posthog.capture({
                     distinctId: user.id,
                     event: "invitation_accepted",
                     properties: {
                        invitationId: invitation.id,
                        organizationId: organization.id,
                        memberId: member.id,
                        role: member.role,
                     },
                  });
               } catch (e) {
                  console.error("[PostHog] Failed to capture invitation_accepted", e);
               }
            },
            beforeRejectInvitation: async ({ invitation, user, organization }) => {
               console.log(`[Invitation] User ${user.email} attempting to reject invitation ${invitation.id} for org ${organization.id}`);
               try {
                  const posthog = getPostHogServer();
                  posthog.capture({
                     distinctId: user.id,
                     event: "invitation_reject_attempted",
                     properties: {
                        invitationId: invitation.id,
                        organizationId: organization.id,
                        invitedEmail: invitation.email,
                        role: invitation.role,
                        invitationStatus: invitation.status,
                     },
                  });
               } catch (e) {
                  console.error("[PostHog] Failed to capture invitation_reject_attempted", e);
               }
            },
            afterRejectInvitation: async ({ invitation, user, organization }) => {
               console.log(`[Invitation] ❌ Rejected invitation ${invitation.id} by user ${user.email} for org ${organization.id}`);
               try {
                  const posthog = getPostHogServer();
                  posthog.capture({
                     distinctId: user.id,
                     event: "invitation_rejected",
                     properties: {
                        invitationId: invitation.id,
                        organizationId: organization.id,
                        invitedEmail: invitation.email,
                        role: invitation.role,
                     },
                  });
               } catch (e) {
                  console.error("[PostHog] Failed to capture invitation_rejected", e);
               }
            },
            afterCancelInvitation: async ({ invitation, cancelledBy, organization }) => {
               console.log(`[Invitation] Canceled invitation ${invitation.id} for ${invitation.email} by ${cancelledBy.email} in org ${organization.id}`);
               try {
                  const posthog = getPostHogServer();
                  posthog.capture({
                     distinctId: cancelledBy.id,
                     event: "invitation_canceled",
                     properties: {
                        invitationId: invitation.id,
                        organizationId: organization.id,
                        invitedEmail: invitation.email,
                        role: invitation.role,
                        status: invitation.status,
                     },
                  });
               } catch (e) {
                  console.error("[PostHog] Failed to capture invitation_canceled", e);
               }
            },
         },
      }),
      lastLoginMethod({
         storeInDatabase: true,
      }),
      magicLink({
         sendMagicLink: async ({ email, url, token }, request) => {
            // Validate email domain before sending magic link
            if (DISALLOWED_DOMAINS.length > 0) {
               const emailDomain = email.split("@")[1]?.toLowerCase();

               if (emailDomain && DISALLOWED_DOMAINS.includes(emailDomain)) {
                  throw new APIError("BAD_REQUEST", {
                     message: `Email addresses from ${emailDomain} are not allowed. Please use your work email.`,
                  });
               }
            }

            await resend.emails.send({
               from: process.env.EMAIL_FROM as string,
               to: email,
               subject: "Sign in to Heyhire",
               html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                     <h2>Welcome to Heyhire!</h2>
                     <p>Click the link below to sign in to your account:</p>
                     <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 5px; margin: 20px 0;">
                        Sign In to Heyhire
                     </a>
                     <p>This link will expire in 5 minutes.</p>
                     <p>If you didn't request this email, you can safely ignore it.</p>
                  </div>
               `,
            });
         },
      }),
      stripe({
         stripeClient,
         stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder",
         createCustomerOnSignUp: true,
         subscription: {
            enabled: true,
            plans: [
               {
                  name: "standard",
                  priceId: process.env.STRIPE_PRICE_ID || "price_placeholder",
                  limits: {
                     searches: 500,
                     candidates: 5000,
                  },
               },
            ],
            getCheckoutSessionParams: async ({ user, session, plan, subscription }) => {
               if (plan.name === "standard" && !subscription) {
                  const referenceId = (session as any)?.referenceId;

                  // One-time trial eligibility: allow trial only if this org has never had
                  // a subscription in a paid/trialing state.
                  // If we can't determine referenceId, fall back to no trial.
                  if (referenceId) {
                     const { subscription: subscriptionTable } = require("@/db/schema");
                     const orgSubscriptions = await db
                        .select({ status: subscriptionTable.status })
                        .from(subscriptionTable)
                        .where(eq(subscriptionTable.referenceId, referenceId));

                     const paidStatuses = ["trialing", "active", "past_due", "paused"];
                     const trialEligible = !orgSubscriptions.some((s: any) => s.status && paidStatuses.includes(s.status));

                     if (trialEligible) {
                        return {
                           params: {
                              payment_method_collection: 'always',
                              // "Cup of coffee" one-time trial fee
                              // Adds a one-off charge on the first invoice only.
                           },
                           // NOTE: referenceId is passed from the client (subscribe-cards.tsx)
                           // Do NOT override it here, let the client value pass through
                        };
                     }
                  }

                  return {
                     params: {
                        payment_method_collection: 'always',
                     },
                     // NOTE: referenceId is passed from the client (subscribe-cards.tsx)
                     // Do NOT override it here, let the client value pass through
                  };
               }
               return {
                  params: {},
                  // NOTE: referenceId is passed from the client (subscribe-cards.tsx)
                  // Do NOT override it here, let the client value pass through
               };
            },
            // Authorize user to manage subscriptions for the organization
            authorizeReference: async ({ user, referenceId, action }) => {
               // If referenceId matches userId, allow (legacy/personal subscriptions)
               if (referenceId === user.id) {
                  return true;
               }

               // Check if user is a member of the organization
               const { member: memberTable } = require("@/db/schema");
               const { eq, and } = require("drizzle-orm");

               const member = await db.query.member.findFirst({
                  where: and(
                     eq(memberTable.userId, user.id),
                     eq(memberTable.organizationId, referenceId)
                  ),
               });

               // Only allow owners and admins to manage subscriptions
               return member?.role === "owner" || member?.role === "admin";
            },
            onSubscriptionComplete: async ({ subscription, plan }) => {
               console.log(`Subscription activated for org ${subscription.referenceId}: ${subscription.id} on plan ${plan.name}`);
            },
            onSubscriptionCancel: async ({ subscription }) => {
               console.log(`Subscription canceled for org ${subscription.referenceId}: ${subscription.id}`);
            },
         },
         // Enhanced webhook event handler with comprehensive logging
         onEvent: async (event) => {
            const timestamp = new Date().toISOString();
            console.log(`\n[Stripe Webhook] ${timestamp}`);
            console.log(`[Stripe Webhook] Event Type: ${event.type}`);
            console.log(`[Stripe Webhook] Event ID: ${event.id}`);

            const { subscription: sub } = require("@/db/schema");
            const { eq } = require("drizzle-orm");

            try {
               switch (event.type) {
                  case "checkout.session.completed": {
                     const session = event.data.object as any;

                     // One-time trial purchase (Stripe Checkout mode=payment)
                     if (session?.mode === "payment" && session?.metadata?.plan === "trial") {
                        const referenceId = session?.metadata?.referenceId || session?.client_reference_id;
                        const userId = session?.metadata?.userId;

                        if (!referenceId) {
                           console.error("[Stripe Webhook] Missing referenceId for trial checkout.session.completed");
                           break;
                        }

                        const existing = await db.query.subscription.findFirst({
                           where: eq(sub.stripeSubscriptionId, session.id),
                        });

                        if (existing) {
                           console.log(`[Stripe Webhook] Trial session already processed: ${session.id}`);
                           break;
                        }

                        const now = new Date();
                        const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

                        const { generateId } = require("@/lib/id");

                        const insertedRows = await db
                           .insert(sub)
                           .values({
                              id: generateId(),
                              plan: "trial",
                              referenceId,
                              stripeCustomerId: session.customer || null,
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

                        const insertedRow = (insertedRows as any[])[0];

                        console.log(`[Stripe Webhook] ✅ Created trial access record: ${insertedRow?.id}`);

                        // Grant credits for trial
                        const { addCredits } = require("@/actions/credits");
                        const { getPlanCreditAllocation, CREDIT_TYPES } = require("@/lib/credits");
                        const { member } = require("@/db/schema");

                        const orgOwner = await db.query.member.findFirst({
                           where: eq(member.organizationId, referenceId),
                        });

                        const creditUserId = userId || orgOwner?.userId;

                        if (orgOwner && creditUserId) {
                           const contactLookupCredits = getPlanCreditAllocation("trial", CREDIT_TYPES.CONTACT_LOOKUP);
                           if (contactLookupCredits > 0) {
                              await addCredits({
                                 organizationId: referenceId,
                                 userId: creditUserId,
                                 amount: contactLookupCredits,
                                 type: "purchase",
                                 creditType: CREDIT_TYPES.CONTACT_LOOKUP,
                                 relatedEntityId: insertedRow?.id,
                                 description: `Trial purchase: ${contactLookupCredits} contact lookup credits`,
                                 metadata: { plan: "trial", checkoutSessionId: session.id },
                              });
                              console.log(`[Stripe Webhook] ✅ Granted ${contactLookupCredits} trial contact lookup credits`);
                           }
                        }
                     }

                     break;
                  }
                  // === SUBSCRIPTION EVENTS ===
                  case "customer.subscription.created":
                  case "customer.subscription.updated": {
                     const stripeSubscription = event.data.object as any;
                     console.log(`[Stripe Webhook] Processing subscription ${stripeSubscription.id}`);
                     console.log(`[Stripe Webhook] Status: ${stripeSubscription.status}`);
                     console.log(`[Stripe Webhook] Customer ID: ${stripeSubscription.customer}`);

                     try {
                        const result = await db
                           .update(sub)
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
                           .where(eq(sub.stripeCustomerId, stripeSubscription.customer))
                           .returning();

                        console.log(`[Stripe Webhook] ✅ Updated subscription record: ${result[0]?.id}`);
                        console.log(`[Stripe Webhook] Updated fields:`, {
                           stripeSubscriptionId: stripeSubscription.id,
                           status: stripeSubscription.status,
                           periodEnd: stripeSubscription.current_period_end ? new Date(stripeSubscription.current_period_end * 1000) : null,
                           trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
                        });

                        const inactiveStatuses = ["canceled", "unpaid", "incomplete_expired"];
                        if (result[0] && stripeSubscription.status && inactiveStatuses.includes(stripeSubscription.status)) {
                           const { setCreditsBalance } = require("@/actions/credits");
                           const { CREDIT_TYPES } = require("@/lib/credits");
                           const subscriptionRecord = result[0];
                           const organizationId = subscriptionRecord.referenceId;

                           const { member } = require("@/db/schema");
                           const orgOwner = await db.query.member.findFirst({
                              where: eq(member.organizationId, organizationId),
                           });

                           if (orgOwner && organizationId) {
                              await setCreditsBalance({
                                 organizationId,
                                 userId: orgOwner.userId,
                                 newBalance: 0,
                                 type: "subscription_grant",
                                 creditType: CREDIT_TYPES.CONTACT_LOOKUP,
                                 relatedEntityId: subscriptionRecord.id,
                                 description: `Subscription became inactive (${stripeSubscription.status}): credits reset to 0`,
                                 metadata: { plan: subscriptionRecord.plan, subscriptionId: subscriptionRecord.id },
                              });
                              console.log(`[Stripe Webhook] ✅ Reset credits to 0 (subscription inactive)`);
                           }
                        }
                     } catch (error) {
                        console.error(`[Stripe Webhook] ❌ Error updating subscription:`, error);
                     }
                     break;
                  }

                  case "customer.subscription.deleted": {
                     const stripeSubscription = event.data.object as any;
                     console.log(`[Stripe Webhook] Subscription deleted: ${stripeSubscription.id}`);

                     try {
                        const result = await db
                           .update(sub)
                           .set({
                              status: "canceled",
                              cancelAtPeriodEnd: false,
                           })
                           .where(eq(sub.stripeSubscriptionId, stripeSubscription.id))
                           .returning();

                        console.log(`[Stripe Webhook] ✅ Marked subscription as canceled: ${result[0]?.id}`);

                        if (result[0]) {
                           const { setCreditsBalance } = require("@/actions/credits");
                           const { CREDIT_TYPES } = require("@/lib/credits");
                           const subscriptionRecord = result[0];
                           const organizationId = subscriptionRecord.referenceId;

                           const { member } = require("@/db/schema");
                           const orgOwner = await db.query.member.findFirst({
                              where: eq(member.organizationId, organizationId),
                           });

                           if (orgOwner && organizationId) {
                              await setCreditsBalance({
                                 organizationId,
                                 userId: orgOwner.userId,
                                 newBalance: 0,
                                 type: "subscription_grant",
                                 creditType: CREDIT_TYPES.CONTACT_LOOKUP,
                                 relatedEntityId: subscriptionRecord.id,
                                 description: "Subscription ended: credits reset to 0",
                                 metadata: { plan: subscriptionRecord.plan, subscriptionId: subscriptionRecord.id },
                              });
                              console.log(`[Stripe Webhook] ✅ Reset credits to 0 (subscription ended)`);
                           }
                        }
                     } catch (error) {
                        console.error(`[Stripe Webhook] ❌ Error marking subscription canceled:`, error);
                     }
                     break;
                  }

                  // === INVOICE EVENTS ===
                  case "invoice.payment_succeeded": {
                     const invoice = event.data.object as any;
                     console.log(`[Stripe Webhook] Payment succeeded for invoice ${invoice.id}`);

                     try {
                        const result = await db
                           .update(sub)
                           .set({
                              status: "active",
                           })
                           .where(eq(sub.stripeCustomerId, invoice.customer))
                           .returning();

                        console.log(`[Stripe Webhook] ✅ Marked subscription as active: ${result[0]?.id}`);

                        // Grant credits for subscription
                        if (result[0]) {
                           const { addCredits, setCreditsBalance } = require("@/actions/credits");
                           const { getPlanCreditAllocation, CREDIT_TYPES } = require("@/lib/credits");
                           const { organization } = require("@/db/schema");

                           const subscriptionRecord = result[0];
                           const plan = subscriptionRecord.plan;
                           const organizationId = subscriptionRecord.referenceId;

                           // Get the organization's owner to use as the userId for the transaction
                           const { member } = require("@/db/schema");
                           const orgOwner = await db.query.member.findFirst({
                              where: eq(member.organizationId, organizationId),
                           });

                           if (orgOwner && organizationId) {
                              // Grant contact lookup credits
                              const contactLookupCredits = getPlanCreditAllocation(plan, CREDIT_TYPES.CONTACT_LOOKUP);
                              if (contactLookupCredits > 0) {
                                 await setCreditsBalance({
                                    organizationId,
                                    userId: orgOwner.userId,
                                    newBalance: contactLookupCredits,
                                    type: "subscription_grant",
                                    creditType: CREDIT_TYPES.CONTACT_LOOKUP,
                                    relatedEntityId: subscriptionRecord.id,
                                    description: `Subscription monthly reset: ${contactLookupCredits} contact lookup credits for ${plan} plan`,
                                    metadata: { plan, subscriptionId: subscriptionRecord.id, invoiceId: invoice.id },
                                 });
                                 console.log(`[Stripe Webhook] ✅ Reset contact lookup credits to ${contactLookupCredits}`);
                              }

                              // Grant export credits
                              const exportCredits = getPlanCreditAllocation(plan, CREDIT_TYPES.EXPORT);
                              if (exportCredits > 0) {
                                 await addCredits({
                                    organizationId,
                                    userId: orgOwner.userId,
                                    amount: exportCredits,
                                    type: "subscription_grant",
                                    creditType: CREDIT_TYPES.EXPORT,
                                    relatedEntityId: subscriptionRecord.id,
                                    description: `Subscription grant: ${exportCredits} export credits for ${plan} plan`,
                                    metadata: { plan, subscriptionId: subscriptionRecord.id },
                                 });
                                 console.log(`[Stripe Webhook] ✅ Granted ${exportCredits} export credits`);
                              }
                           }
                        }
                     } catch (error) {
                        console.error(`[Stripe Webhook] ❌ Error updating subscription status:`, error);
                     }
                     break;
                  }

                  case "invoice.payment_failed": {
                     const invoice = event.data.object as any;
                     console.log(`[Stripe Webhook] ⚠️ Payment failed for invoice ${invoice.id}`);

                     try {
                        const result = await db
                           .update(sub)
                           .set({
                              status: "past_due",
                           })
                           .where(eq(sub.stripeCustomerId, invoice.customer))
                           .returning();

                        console.log(`[Stripe Webhook] ✅ Marked subscription as past_due: ${result[0]?.id}`);

                        if (result[0]) {
                           const { setCreditsBalance } = require("@/actions/credits");
                           const { CREDIT_TYPES } = require("@/lib/credits");
                           const subscriptionRecord = result[0];
                           const organizationId = subscriptionRecord.referenceId;

                           const { member } = require("@/db/schema");
                           const orgOwner = await db.query.member.findFirst({
                              where: eq(member.organizationId, organizationId),
                           });

                           if (orgOwner && organizationId) {
                              await setCreditsBalance({
                                 organizationId,
                                 userId: orgOwner.userId,
                                 newBalance: 0,
                                 type: "subscription_grant",
                                 creditType: CREDIT_TYPES.CONTACT_LOOKUP,
                                 relatedEntityId: subscriptionRecord.id,
                                 description: "Subscription payment failed: credits reset to 0",
                                 metadata: { plan: subscriptionRecord.plan, subscriptionId: subscriptionRecord.id, invoiceId: invoice.id },
                              });
                              console.log(`[Stripe Webhook] ✅ Reset credits to 0 (payment failed)`);
                           }
                        }
                     } catch (error) {
                        console.error(`[Stripe Webhook] ❌ Error handling failed payment:`, error);
                     }
                     break;
                  }

                  // === CUSTOMER EVENTS ===
                  case "customer.deleted": {
                     const customer = event.data.object as any;
                     console.log(`[Stripe Webhook] Customer deleted: ${customer.id}`);
                     break;
                  }

                  // === CHECKOUT EVENTS ===
                  case "checkout.session.completed": {
                     const session = event.data.object as any;
                     console.log(`[Stripe Webhook] Checkout completed: ${session.id}`);
                     console.log(`[Stripe Webhook] Customer: ${session.customer}`);
                     break;
                  }

                  default: {
                     console.log(`[Stripe Webhook] ℹ️ Unhandled event type: ${event.type}`);
                  }
               }
            } catch (error) {
               console.error(`[Stripe Webhook] ❌ Error processing event:`, error);
            }

            console.log(`[Stripe Webhook] ${timestamp} - Event processing complete\n`);
         },
      })
   ],
   databaseHooks: {
      user: {
         create: {
            before: async (user: { email: string }) => {
               // Only validate if domains are configured
               if (DISALLOWED_DOMAINS.length > 0) {
                  const emailDomain = user.email.split("@")[1]?.toLowerCase();

                  if (emailDomain && DISALLOWED_DOMAINS.includes(emailDomain)) {
                     throw new APIError("BAD_REQUEST", {
                        message: `Email addresses from ${emailDomain} are not allowed. Please use your work email.`,
                     });
                  }
               }

               return { data: user };
            },
         },
      },
      session: {
         create: {
            before: async (session: { userId: string }) => {
               // Get the user's first organization to set as active
               const { member: memberTable } = require("@/db/schema");
               const { eq } = require("drizzle-orm");

               const userMember = await db.query.member.findFirst({
                  where: eq(memberTable.userId, session.userId),
                  with: {
                     organization: true,
                  },
                  orderBy: (member, { desc }) => [desc(member.createdAt)],
               });

               if (userMember) {
                  console.log(`[Auth] Auto-setting active organization for user ${session.userId}: ${userMember.organizationId}`);
                  return {
                     data: {
                        ...session,
                        activeOrganizationId: userMember.organizationId,
                     },
                  };
               }

               return { data: session };
            },
         },
      },
   },
   rateLimit: {
      window: 60, // time window in seconds
      max: 10,
   },
})

// Export stripeClient for use in server actions
export { stripeClient };