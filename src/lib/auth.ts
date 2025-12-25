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
import { eq, and } from "drizzle-orm";
import { trackServerEvent } from "@/lib/posthog/track";
import { handleStripeEvent } from "@/lib/stripe/webhooks";
import { logger } from "@/lib/axiom/server";
import { InvitationAcceptedEmail, InvitationEmail, MagicLinkEmail, WelcomeEmail } from "@/emails";
import { generateId } from "@/lib/id";
import { CREDIT_TYPES, getTrialCreditAllocation } from "@/lib/credits";
import { PLAN_LIMITS } from "@/types/plans";
import { ensureDemoOrganization } from "@/lib/demo";



const log = logger.with({ service: "auth" });

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
         creditType: CREDIT_TYPES.CONTACT_LOOKUP,
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

   trackServerEvent(ownerId, params.type, params.referenceId, {
      internal_subscription_id: params.internalSubscriptionId,
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
   trustedOrigins: [appUrl],
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
                  organizationId: organization.id,
                  organizationName: organization.name,
                  userEmail: user.email,
               });
               trackServerEvent(user.id, "organization_created", organization.id, {
                  organization_name: organization.name,
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
                  invitationId: invitation.id,
                  invitedEmail: invitation.email,
                  organizationId: organization.id,
                  inviterId: inviter.id,
               });
               trackServerEvent(inviter.id, "invitation_sent", organization.id, {
                  invitation_id: invitation.id,
                  invited_email: invitation.email,
                  role: invitation.role,
               });
            },
            afterAcceptInvitation: async ({ invitation, member, user, organization }) => {
               log.info("Invitation accepted", {
                  invitationId: invitation.id,
                  memberId: member.id,
                  organizationId: organization.id,
                  userEmail: user.email,
                  role: member.role,
               });
               trackServerEvent(user.id, "invitation_accepted", organization.id, {
                  invitation_id: invitation.id,
                  member_id: member.id,
                  role: member.role,
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
                  invitationId: invitation.id,
                  organizationId: organization.id,
                  userEmail: user.email,
               });
               trackServerEvent(user.id, "invitation_rejected", organization.id, {
                  invitation_id: invitation.id,
               });
            },
            afterCancelInvitation: async ({ invitation, cancelledBy, organization }) => {
               log.info("Invitation canceled", {
                  invitationId: invitation.id,
                  invitedEmail: invitation.email,
                  cancelledByEmail: cancelledBy.email,
                  organizationId: organization.id,
               });
               trackServerEvent(cancelledBy.id, "invitation_canceled", organization.id, {
                  invitation_id: invitation.id,
                  invited_email: invitation.email,
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

                        const creditsToGrant = getTrialCreditAllocation("pro", CREDIT_TYPES.CONTACT_LOOKUP);
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
                              creditType: CREDIT_TYPES.CONTACT_LOOKUP,
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

                        trackServerEvent(ownerId, "trial_started", referenceId, {
                           internal_subscription_id: subscription.id,
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
                        trial_from_plan: true,
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

               return memberRecord?.role === "owner" || memberRecord?.role === "admin";
            },
            onSubscriptionComplete: async ({ subscription, plan }) => {
               log.info("Stripe subscription activated", {
                  stripeSubscriptionId: subscription.id,
                  planName: plan.name,
               });
            },
            onSubscriptionUpdate: async ({ subscription }) => {
               const status = subscription.status;
               if (status !== "unpaid" && status !== "incomplete_expired") return;

               const referenceId = subscription.referenceId;
               if (!referenceId) return;

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
               log.info("Stripe subscription canceled", {
                  stripeSubscriptionId: subscription.id,
               });
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
            after: async (createdUser) => {
               try {
                  await db.transaction(async (tx) => {
                     const demoOrgId = await ensureDemoOrganization(tx);

                     const existingMember = await tx.query.member.findFirst({
                        where: and(
                           eq(schema.member.userId, createdUser.id),
                           eq(schema.member.organizationId, demoOrgId)
                        ),
                        columns: { id: true },
                     });

                     if (existingMember?.id) return;

                     await tx.insert(schema.member).values({
                        id: generateId(),
                        organizationId: demoOrgId,
                        userId: createdUser.id,
                        role: "viewer",
                     });
                  });
               } catch (error) {
                  log.error("Failed to add demo org membership on signup", {
                     userId: createdUser.id,
                     error,
                  });
               }
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
         },
      },
   },
   rateLimit: {
      window: 60,
      max: 10,
   },
});

// Export stripeClient for use in server actions
export { stripeClient };