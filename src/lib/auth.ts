import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, magicLink, lastLoginMethod, anonymous } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import { APIError } from "better-auth/api";
import { db } from "@/db/drizzle";
import * as schema from "@/db/schema";
import { Resend } from "resend";
import Stripe from "stripe";
import { DISALLOWED_DOMAINS } from "./constants";
import { eq, and } from "drizzle-orm";
import { getPostHogServer } from "@/lib/posthog/posthog-server";
import { handleStripeEvent } from "@/lib/stripe/webhooks";
import { log } from "@/lib/axiom/server";
import { InvitationAcceptedEmail, InvitationEmail, MagicLinkEmail, WelcomeEmail } from "@/emails";
import { generateId } from "@/lib/id";
import { ADMIN_ROLES } from "@/lib/roles";
import { CREDIT_TYPES, getPlanCreditAllocation, getTrialCreditAllocation } from "@/lib/credits";
import { PLAN_LIMITS } from "@/types/plans";

const source = "auth";

const resend = new Resend(process.env.RESEND_API_KEY);


const invitationExpiresInSeconds = 60 * 60 * 48;

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover", // Latest API version as of Stripe SDK v20.0.0
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function markBillingActionProcessed(params: {
   key: string;
   type: string;
   referenceId?: string | null;
   stripeCustomerId?: string | null;
   stripeSubscriptionId?: string | null;
}) {
   try {
      await db.insert(schema.stripeWebhookEvents).values({
         id: generateId(),
         stripeEventId: params.key,
         stripeEventType: params.type,
         referenceId: params.referenceId ?? null,
         stripeCustomerId: params.stripeCustomerId ?? null,
         stripeSubscriptionId: params.stripeSubscriptionId ?? null,
      });
   } catch {
      // unique constraint hit -> already processed
   }
}

async function isBillingActionProcessed(key: string) {
   const existing = await db.query.stripeWebhookEvents.findFirst({
      where: eq(schema.stripeWebhookEvents.stripeEventId, key),
      columns: { stripeEventId: true },
   });
   return !!existing;
}

async function revokeOrgCreditsToZero(params: {
   key: string;
   type: string;
   referenceId: string;
   internalSubscriptionId: string;
   stripeCustomerId?: string | null;
   stripeSubscriptionId?: string | null;
}) {
   if (await isBillingActionProcessed(params.key)) return;

   const owner = await db.query.member.findFirst({
      where: and(
         eq(schema.member.organizationId, params.referenceId),
         eq(schema.member.role, "owner")
      ),
   });
   const ownerId = owner?.userId;
   if (!ownerId) return;

   await db.transaction(async (tx) => {
      const org = await tx.query.organization.findFirst({
         where: eq(schema.organization.id, params.referenceId),
         columns: { credits: true },
      });

      const balanceBefore = org?.credits ?? 0;
      if (balanceBefore === 0) return;

      await tx
         .update(schema.organization)
         .set({ credits: 0 })
         .where(eq(schema.organization.id, params.referenceId));

      await tx.insert(schema.creditTransactions).values({
         id: generateId(),
         organizationId: params.referenceId,
         userId: ownerId,
         type: "subscription_grant",
         creditType: CREDIT_TYPES.GENERAL,
         amount: -balanceBefore,
         balanceBefore,
         balanceAfter: 0,
         relatedEntityId: params.internalSubscriptionId,
         description: "Subscription ended",
         metadata: JSON.stringify({
            reason: params.type,
            subscriptionId: params.internalSubscriptionId,
         }),
      });
   });

   const posthog = getPostHogServer();
   posthog.capture({
      distinctId: ownerId,
      event: params.type,
      groups: { organization: params.referenceId },
      properties: {
         internal_subscription_id: params.internalSubscriptionId,
      },
   });

   await markBillingActionProcessed({
      key: params.key,
      type: params.type,
      referenceId: params.referenceId,
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
   });
}

async function grantPlanCreditsToLimit(params: {
   key: string;
   type: string;
   referenceId: string;
   plan: string;
   internalSubscriptionId: string;
   stripeEventId?: string | null;
   stripeCustomerId?: string | null;
   stripeSubscriptionId?: string | null;
}) {
   if (await isBillingActionProcessed(params.key)) return;

   const owner = await db.query.member.findFirst({
      where: and(
         eq(schema.member.organizationId, params.referenceId),
         eq(schema.member.role, "owner")
      ),
   });
   const ownerId = owner?.userId;
   if (!ownerId) return;

   const creditsToGrant = getPlanCreditAllocation(params.plan);
   if (creditsToGrant <= 0) return;

   await db.transaction(async (tx) => {
      const org = await tx.query.organization.findFirst({
         where: eq(schema.organization.id, params.referenceId),
         columns: { credits: true },
      });

      const balanceBefore = org?.credits ?? 0;

      // Transaction 1: Burn out remaining credits if any
      if (balanceBefore > 0) {
         await tx.insert(schema.creditTransactions).values({
            id: generateId(),
            organizationId: params.referenceId,
            userId: ownerId,
            type: "subscription_grant",
            creditType: CREDIT_TYPES.GENERAL,
            amount: -balanceBefore,
            balanceBefore,
            balanceAfter: 0,
            relatedEntityId: params.internalSubscriptionId,
            description: `Period reset: ${balanceBefore} unused credits expired`,
            metadata: JSON.stringify({
               reason: "period_reset_burn",
               stripeEventId: params.stripeEventId,
               subscriptionId: params.internalSubscriptionId,
            }),
         });
      }

      // Transaction 2: Grant full plan credits
      await tx
         .update(schema.organization)
         .set({ credits: creditsToGrant })
         .where(eq(schema.organization.id, params.referenceId));

      await tx.insert(schema.creditTransactions).values({
         id: generateId(),
         organizationId: params.referenceId,
         userId: ownerId,
         type: "subscription_grant",
         creditType: CREDIT_TYPES.GENERAL,
         amount: creditsToGrant,
         balanceBefore: 0,
         balanceAfter: creditsToGrant,
         relatedEntityId: params.internalSubscriptionId,
         description: `Plan allocation: ${creditsToGrant} credits for ${params.plan} plan`,
         metadata: JSON.stringify({
            reason: "period_reset_grant",
            stripeEventId: params.stripeEventId,
            subscriptionId: params.internalSubscriptionId,
         }),
      });
   });

   const posthog = getPostHogServer();
   posthog.capture({
      distinctId: ownerId,
      event: params.type,
      groups: { organization: params.referenceId },
      properties: {
         internal_subscription_id: params.internalSubscriptionId,
         plan: params.plan,
      },
   });

   await markBillingActionProcessed({
      key: params.key,
      type: params.type,
      referenceId: params.referenceId,
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
   });
}

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
      "https://*.heyhire.ai",
      "https://heyhire.ai",
   ],
   socialProviders: {
      google: {
         clientId: process.env.GOOGLE_CLIENT_ID as string,
         clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
         redirectURI: `${appUrl}/api/auth/callback/google`,
      },
   },
   plugins: [
      // Organization plugin
      organization({
         invitationExpiresIn: invitationExpiresInSeconds,
         schema: {
            organization: {
               additionalFields: {
                  googleLink: {
                     type: "string",
                     input: true,
                     required: false,
                  }
               }
            }
         },
         async sendInvitationEmail(data) {
            const inviteLink = `${appUrl}/auth/accept-invitation/${data.id}`;
            const emailContent = InvitationEmail({
               inviterNameOrEmail: data.inviter.user.name || data.inviter.user.email,
               organizationName: data.organization.name,
               inviteLink,
               invitationExpiresInSeconds,
            });
            await resend.emails.send({
               from: process.env.EMAIL_FROM as string,
               to: data.email,
               subject: `You've been invited to join ${data.organization.name}`,
               react: emailContent,
            });
         },
         organizationHooks: {
            afterCreateOrganization: async ({ organization, user }) => {
               log.info("Organization created", {
                  source,
                  organizationId: organization.id,
                  organizationName: organization.name,
                  userEmail: user.email,
               });

               const posthog = getPostHogServer();

               // Set user's first organization (set_once - won't overwrite if already set)
               posthog.capture({
                  distinctId: user.id,
                  event: "$set",
                  properties: {
                     $set_once: {
                        first_organization_id: organization.id,
                        first_organization_name: organization.name,
                     },
                  },
               });

               // Register organization as a group in PostHog
               posthog.groupIdentify({
                  groupType: "organization",
                  groupKey: organization.id,
                  properties: {
                     name: organization.name,
                     slug: organization.slug,
                     created_at: new Date().toISOString(),
                     creator_user_id: user.id,
                  },
               });

               posthog.capture({
                  distinctId: user.id,
                  event: "organization_created",
                  groups: { organization: organization.id },
                  properties: {
                     organization_name: organization.name,
                  },
               });

               const emailContent = WelcomeEmail({
                  userNameOrEmail: user.name || user.email,
                  organizationName: organization.name,
                  ctaUrl: `${appUrl}/search`,
               });
               await resend.emails.send({
                  from: process.env.EMAIL_FROM as string,
                  to: user.email,
                  subject: `Welcome to Heyhire — ${organization.name} is ready`,
                  react: emailContent,
               });
            },
            afterCreateInvitation: async ({ invitation, inviter, organization }) => {
               log.info("Invitation created", {
                  source,
                  invitationId: invitation.id,
                  invitedEmail: invitation.email,
                  organizationId: organization.id,
                  inviterId: inviter.id,
               });
               const posthog = getPostHogServer();
               posthog.capture({
                  distinctId: inviter.id,
                  event: "invitation_sent",
                  groups: { organization: organization.id },
                  properties: {
                     invitation_id: invitation.id,
                     invited_email: invitation.email,
                     role: invitation.role,
                  },
               });
            },
            afterAcceptInvitation: async ({ invitation, member, user, organization }) => {
               log.info("Invitation accepted", {
                  source,
                  invitationId: invitation.id,
                  memberId: member.id,
                  organizationId: organization.id,
                  userEmail: user.email,
                  role: member.role,
               });

               // Ensure organization group exists in PostHog with current properties
               const posthog = getPostHogServer();
               posthog.groupIdentify({
                  groupType: "organization",
                  groupKey: organization.id,
                  properties: {
                     name: organization.name,
                     slug: organization.slug,
                  },
               });

               posthog.capture({
                  distinctId: user.id,
                  event: "invitation_accepted",
                  groups: { organization: organization.id },
                  properties: {
                     invitation_id: invitation.id,
                     member_id: member.id,
                     role: member.role,
                  },
               });

               const inviter = await db.query.user.findFirst({
                  where: eq(schema.user.id, invitation.inviterId),
                  columns: { email: true, name: true },
               });
               if (inviter?.email) {
                  const emailContent = InvitationAcceptedEmail({
                     inviterNameOrEmail: inviter.name || inviter.email,
                     invitedNameOrEmail: user.name || user.email,
                     organizationName: organization.name,
                     ctaUrl: `${appUrl}/members`,
                  });
                  await resend.emails.send({
                     from: process.env.EMAIL_FROM as string,
                     to: inviter.email,
                     subject: `${user.name || user.email} joined ${organization.name}`,
                     react: emailContent,
                  });
               }
            },
            afterRejectInvitation: async ({ invitation, user, organization }) => {
               log.info("Invitation rejected", {
                  source,
                  invitationId: invitation.id,
                  organizationId: organization.id,
                  userEmail: user.email,
               });
               const posthog = getPostHogServer();
               posthog.capture({
                  distinctId: user.id,
                  event: "invitation_rejected",
                  groups: { organization: organization.id },
                  properties: {
                     invitation_id: invitation.id,
                  },
               });
            },
            afterCancelInvitation: async ({ invitation, cancelledBy, organization }) => {
               log.info("Invitation canceled", {
                  source,
                  invitationId: invitation.id,
                  invitedEmail: invitation.email,
                  cancelledByEmail: cancelledBy.email,
                  organizationId: organization.id,
               });
               const posthog = getPostHogServer();
               posthog.capture({
                  distinctId: cancelledBy.id,
                  event: "invitation_canceled",
                  groups: { organization: organization.id },
                  properties: {
                     invitation_id: invitation.id,
                     invited_email: invitation.email,
                  },
               });
            },
         },
      }),

      // Last login method tracking
      lastLoginMethod({
         storeInDatabase: true,
      }),

      // Magic link authentication
      magicLink({
         sendMagicLink: async ({ email, url }) => {
            if (DISALLOWED_DOMAINS.length > 0) {
               const emailDomain = email.split("@")[1]?.toLowerCase();
               if (emailDomain && DISALLOWED_DOMAINS.includes(emailDomain)) {
                  throw new APIError("BAD_REQUEST", {
                     message: `Email addresses from ${emailDomain} are not allowed. Please use your work email.`,
                  });
               }
            }

            const emailContent = MagicLinkEmail({ url });
            await resend.emails.send({
               from: process.env.EMAIL_FROM as string,
               to: email,
               subject: "Sign in to Heyhire",
               react: emailContent,
            });
         },
      }),

      // Stripe subscription plugin
      stripe({
         stripeClient,
         stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "whsec_placeholder",
         createCustomerOnSignUp: false,
         // allowReTrialsForDifferentPlans: false,
         subscription: {
            enabled: true,
            plans: [
               {
                  name: "pro",
                  priceId: process.env.STRIPE_PRO_PRICE_ID || "price_placeholder",
                  limits: {
                     credits: PLAN_LIMITS.pro.credits,
                     trialCredits: PLAN_LIMITS.pro.trialCredits,
                  },
                  freeTrial: {
                     days: 3,
                     onTrialStart: async (subscription) => {
                        const key = `better_auth:trial_start:${subscription.id}`;
                        if (await isBillingActionProcessed(key)) return;

                        const referenceId = subscription.referenceId;
                        if (!referenceId) return;

                        const owner = await db.query.member.findFirst({
                           where: and(
                              eq(schema.member.organizationId, referenceId),
                              eq(schema.member.role, "owner")
                           ),
                        });
                        const ownerId = owner?.userId;
                        if (!ownerId) return;

                        const creditsToGrant = getTrialCreditAllocation("pro");
                        if (creditsToGrant <= 0) return;

                        await db.transaction(async (tx) => {
                           const org = await tx.query.organization.findFirst({
                              where: eq(schema.organization.id, referenceId),
                              columns: { credits: true },
                           });

                           const balanceBefore = org?.credits ?? 0;
                           await tx
                              .update(schema.organization)
                              .set({ credits: creditsToGrant })
                              .where(eq(schema.organization.id, referenceId));

                           await tx.insert(schema.creditTransactions).values({
                              id: generateId(),
                              organizationId: referenceId,
                              userId: ownerId,
                              type: "subscription_grant",
                              creditType: CREDIT_TYPES.GENERAL,
                              amount: creditsToGrant - balanceBefore,
                              balanceBefore,
                              balanceAfter: creditsToGrant,
                              relatedEntityId: subscription.id,
                              description: `Trial credits: ${creditsToGrant} credits for pro plan`,
                              metadata: JSON.stringify({
                                 reason: "trial_start",
                                 subscriptionId: subscription.id,
                              }),
                           });
                        });

                        // Link Stripe customer to PostHog identity with set_once
                        const posthog = getPostHogServer();
                        posthog.capture({
                           distinctId: ownerId,
                           event: "$set",
                           properties: {
                              $set: {
                                 current_plan: "pro",
                                 is_trialing: true,
                              },
                              $set_once: {
                                 stripe_customer_id: subscription.stripeCustomerId,
                                 trial_started_at: new Date().toISOString(),
                                 first_plan: "pro",
                              },
                           },
                        });

                        if (subscription.stripeCustomerId) {
                           posthog.groupIdentify({
                              groupType: "organization",
                              groupKey: referenceId,
                              properties: {
                                 stripe_customer_id: subscription.stripeCustomerId,
                                 stripe_subscription_id: subscription.stripeSubscriptionId,
                                 current_plan: "pro",
                                 is_trialing: true,
                              },
                           });
                        }

                        posthog.capture({
                           distinctId: ownerId,
                           event: "trial_started",
                           groups: { organization: referenceId },
                           properties: {
                              internal_subscription_id: subscription.id,
                              stripe_customer_id: subscription.stripeCustomerId,
                           },
                        });

                        await markBillingActionProcessed({
                           key,
                           type: "trial_start",
                           referenceId,
                           stripeCustomerId: subscription.stripeCustomerId,
                           stripeSubscriptionId: subscription.stripeSubscriptionId,
                        });
                     },
                     onTrialExpired: async (subscription) => {
                        const referenceId = subscription.referenceId;
                        if (!referenceId) return;

                        await revokeOrgCreditsToZero({
                           key: `better_auth:trial_expired:${subscription.id}`,
                           type: "trial_expired",
                           referenceId,
                           internalSubscriptionId: subscription.id,
                           stripeCustomerId: subscription.stripeCustomerId,
                           stripeSubscriptionId: subscription.stripeSubscriptionId,
                        });
                     },
                  },
               },
            ],
            getCheckoutSessionParams: async ({ user, session, plan, subscription }) => {
               void session;

               const referenceId = subscription?.referenceId;
               if (!referenceId) {
                  throw new APIError("BAD_REQUEST", {
                     message: "Missing referenceId for subscription checkout",
                  });
               }
               return {
                  params: {
                     payment_method_collection: "always",
                     client_reference_id: referenceId,
                     metadata: {
                        referenceId,
                        plan: plan?.name,
                        userId: user?.id,
                     },
                     subscription_data: {
                        trial_period_days: plan?.freeTrial?.days,
                        metadata: {
                           referenceId,
                           plan: plan?.name,
                        },
                     },
                  },
               };
            },
            authorizeReference: async ({ user, referenceId }) => {
               const memberRecord = await db.query.member.findFirst({
                  where: and(
                     eq(schema.member.userId, user.id),
                     eq(schema.member.organizationId, referenceId)
                  ),
               });

               return memberRecord?.role ? ADMIN_ROLES.has(memberRecord.role) : false;
            },
            onSubscriptionComplete: async ({ subscription, plan }) => {
               log.info("Stripe subscription activated", {
                  source,
                  stripeSubscriptionId: subscription.id,
                  planName: plan.name,
               });
            },
            onSubscriptionUpdate: async ({ event, subscription }) => {
               const status = subscription.status;
               const referenceId = subscription.referenceId;
               if (!referenceId) return;

               const stripeSubscription = event?.data?.object as Stripe.Subscription | undefined;
               const previousAttributes = (event?.data as { previous_attributes?: Record<string, unknown> })?.previous_attributes;
               const stripeStatus = stripeSubscription?.status ?? null;
               const periodStart = stripeSubscription?.items?.data?.[0]?.current_period_start;
               const periodStartKey = periodStart
                  ? String(periodStart)
                  : subscription.periodStart
                     ? String(Math.floor(subscription.periodStart.getTime() / 1000))
                     : "unknown";

               const isActivation = previousAttributes?.status === "trialing" && stripeStatus === "active";
               const isPeriodRoll = typeof previousAttributes?.current_period_start === "number" && stripeStatus === "active";

               if (subscription.plan && (isActivation || isPeriodRoll)) {
                  const creditsKey = `better_auth:credits_reset:${subscription.id}:${periodStartKey}`;
                  await grantPlanCreditsToLimit({
                     key: creditsKey,
                     type: "credits_reset",
                     referenceId,
                     plan: subscription.plan,
                     internalSubscriptionId: subscription.id,
                     stripeEventId: event?.id ?? null,
                     stripeCustomerId: subscription.stripeCustomerId,
                     stripeSubscriptionId: subscription.stripeSubscriptionId,
                  });
               }

               if (isActivation) {
                  const owner = await db.query.member.findFirst({
                     where: and(
                        eq(schema.member.organizationId, referenceId),
                        eq(schema.member.role, "owner")
                     ),
                  });
                  const ownerId = owner?.userId;
                  if (ownerId) {
                     const posthog = getPostHogServer();

                     // Update person properties: trial ended, now active
                     posthog.capture({
                        distinctId: ownerId,
                        event: "$set",
                        properties: {
                           $set: {
                              current_plan: subscription.plan,
                              is_trialing: false,
                              subscription_status: "active",
                           },
                        },
                     });

                     // Update organization group properties
                     posthog.groupIdentify({
                        groupType: "organization",
                        groupKey: referenceId,
                        properties: {
                           current_plan: subscription.plan,
                           is_trialing: false,
                           subscription_status: "active",
                        },
                     });

                     posthog.capture({
                        distinctId: ownerId,
                        event: "subscription_activated",
                        groups: { organization: referenceId },
                        properties: {
                           internal_subscription_id: subscription.id,
                           plan: subscription.plan,
                           stripe_subscription_id: subscription.stripeSubscriptionId,
                        },
                     });
                  }
               }

               // Detect plan changes (upgrades/downgrades)
               const previousItemPriceId = (previousAttributes?.items as { data?: Array<{ price?: { id?: string } }> })?.data?.[0]?.price?.id;
               const currentItemPriceId = stripeSubscription?.items?.data?.[0]?.price?.id;

               if (previousItemPriceId && currentItemPriceId && previousItemPriceId !== currentItemPriceId) {
                  const owner = await db.query.member.findFirst({
                     where: and(
                        eq(schema.member.organizationId, referenceId),
                        eq(schema.member.role, "owner")
                     ),
                  });
                  if (owner?.userId) {
                     const posthog = getPostHogServer();
                     posthog.capture({
                        distinctId: owner.userId,
                        event: "subscription_plan_changed",
                        groups: { organization: referenceId },
                        properties: {
                           internal_subscription_id: subscription.id,
                           from_price_id: previousItemPriceId,
                           to_price_id: currentItemPriceId,
                           to_plan: subscription.plan,
                           stripe_subscription_id: subscription.stripeSubscriptionId,
                        },
                     });
                  }
               }

               if (status !== "unpaid" && status !== "incomplete_expired") return;

               await revokeOrgCreditsToZero({
                  key: `better_auth:subscription_inactive:${subscription.id}:${status}`,
                  type: `subscription_${status}`,
                  referenceId,
                  internalSubscriptionId: subscription.id,
                  stripeCustomerId: subscription.stripeCustomerId,
                  stripeSubscriptionId: subscription.stripeSubscriptionId,
               });
            },
            onSubscriptionCancel: async ({ subscription }) => {
               const referenceId = subscription.referenceId;
               log.info("Stripe subscription canceled", {
                  source,
                  stripeSubscriptionId: subscription.id,
                  referenceId,
               });

               if (referenceId) {
                  const owner = await db.query.member.findFirst({
                     where: and(
                        eq(schema.member.organizationId, referenceId),
                        eq(schema.member.role, "owner")
                     ),
                  });
                  if (owner?.userId) {
                     const posthog = getPostHogServer();

                     // Update person properties: subscription canceled
                     posthog.capture({
                        distinctId: owner.userId,
                        event: "$set",
                        properties: {
                           $set: {
                              current_plan: "none",
                              is_trialing: false,
                              subscription_status: "canceled",
                           },
                        },
                     });

                     // Update organization group properties
                     posthog.groupIdentify({
                        groupType: "organization",
                        groupKey: referenceId,
                        properties: {
                           current_plan: "none",
                           is_trialing: false,
                           subscription_status: "canceled",
                        },
                     });

                     posthog.capture({
                        distinctId: owner.userId,
                        event: "subscription_canceled",
                        groups: { organization: referenceId },
                        properties: {
                           internal_subscription_id: subscription.id,
                           stripe_subscription_id: subscription.stripeSubscriptionId,
                           plan: subscription.plan,
                        },
                     });
                  }
               }
            },
            onSubscriptionDeleted: async ({ subscription }) => {
               const referenceId = subscription.referenceId;
               if (!referenceId) return;
               await revokeOrgCreditsToZero({
                  key: `better_auth:subscription_deleted:${subscription.id}`,
                  type: "subscription_deleted",
                  referenceId,
                  internalSubscriptionId: subscription.id,
                  stripeCustomerId: subscription.stripeCustomerId,
                  stripeSubscriptionId: subscription.stripeSubscriptionId,
               });
            },
         },
         onEvent: async (event) => {
            await handleStripeEvent(event, stripeClient);
         },
      }),

      // Anonymous plugin for demo mode
      anonymous({
         emailDomainName: "demo.heyhire.ai",
      }),
   ],
   databaseHooks: {
      user: {
         create: {
            before: async (user: { email: string }) => {
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
            after: async (user) => {
               const posthog = getPostHogServer();
               const emailDomain = user.email.split("@")[1]?.toLowerCase();

               // Set person properties with set_once for immutable data
               posthog.capture({
                  distinctId: user.id,
                  event: "$set",
                  properties: {
                     $set: {
                        email: user.email,
                        name: user.name,
                     },
                     $set_once: {
                        user_db_id: user.id,
                        first_email: user.email,
                        signed_up_at: new Date().toISOString(),
                        email_domain: emailDomain,
                     },
                  },
               });

               posthog.capture({
                  distinctId: user.id,
                  event: "user_signed_up",
                  properties: {
                     email_domain: emailDomain,
                  },
               });
            },
         },
      },
      session: {
         create: {
            before: async (session: { userId: string }) => {
               const userMember = await db.query.member.findFirst({
                  where: eq(schema.member.userId, session.userId),
                  with: { organization: true },
                  orderBy: (member, { desc }) => [desc(member.createdAt)],
               });

               if (userMember) {
                  log.info("Auto-setting active org", {
                     source,
                     userId: session.userId,
                     organizationId: userMember.organizationId,
                  });
                  return {
                     data: {
                        ...session,
                        activeOrganizationId: userMember.organizationId,
                     },
                  };
               }

               return { data: session };
            },
            after: async (session) => {
               const userRecord = await db.query.user.findFirst({
                  where: eq(schema.user.id, session.userId),
                  columns: { lastLoginMethod: true },
               });

               const authMethod = userRecord?.lastLoginMethod || "unknown";

               // Track auth method (email/name set by user.create.after and client-side identify)
               const posthog = getPostHogServer();
               posthog.capture({
                  distinctId: session.userId,
                  event: "$set",
                  properties: {
                     $set: {
                        last_auth_method: authMethod,
                     },
                     $set_once: {
                        first_auth_method: authMethod,
                        first_seen_at: new Date().toISOString(),
                     },
                  },
               });

               posthog.capture({
                  distinctId: session.userId,
                  event: "user_signed_in",
                  properties: {
                     auth_method: authMethod,
                  },
               });
            },
         },
         delete: {
            before: async (session) => {
               // Track sign out server-side (more reliable than client-side)
               const posthog = getPostHogServer();
               const activeOrgId = (session as { activeOrganizationId?: string }).activeOrganizationId;
               posthog.capture({
                  distinctId: session.userId,
                  event: "user_signed_out",
                  ...(activeOrgId && { groups: { organization: activeOrgId } }),
                  properties: {
                     session_id: session.id,
                     organization_id: activeOrgId ?? null,
                  },
               });
            },
         },
      },
   },
   rateLimit: {
      window: 60,
      max: 10,
   },
   // Cookies are isolated per subdomain (app.heyhire.ai vs demo.heyhire.ai)
   // This ensures demo sessions don't leak to production and vice versa
   advanced: {
      crossSubDomainCookies: {
         enabled: false,
      },
   },
});

// Export stripeClient for use in server actions
export { stripeClient };
