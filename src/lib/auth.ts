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



const log = logger.with({ service: "auth" });

const resend = new Resend(process.env.RESEND_API_KEY);

const invitationExpiresInSeconds = 60 * 60 * 48;

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover", // Latest API version as of Stripe SDK v20.0.0
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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
         createCustomerOnSignUp: true,
         subscription: {
            enabled: true,
            plans: [
               {
                  name: "starter",
                  priceId: process.env.STRIPE_STARTER_PRICE_ID || "price_placeholder",
                  limits: {
                     reveals: 300,
                  },
                  freeTrial: {
                     days: 7,
                  },
               },
               {
                  name: "pro",
                  priceId: process.env.STRIPE_PRO_PRICE_ID || "price_placeholder",
                  limits: {
                     reveals: 1000,
                  },
               },
            ],
            getCheckoutSessionParams: async ({ user, session, plan, subscription }) => {
               void user;
               void session;
               void plan;
               void subscription;
               return {
                  params: {
                     payment_method_collection: "always",
                  },
               };
            },
            authorizeReference: async ({ user, referenceId }) => {
               if (referenceId === user.id) return true;

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
            onSubscriptionCancel: async ({ subscription }) => {
               log.info("Stripe subscription canceled", {
                  stripeSubscriptionId: subscription.id,
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