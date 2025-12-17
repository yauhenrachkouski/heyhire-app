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
import { isTrialEligible } from "@/lib/stripe/subscription-service";

// =============================================================================
// CONFIG VALIDATION
// =============================================================================

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
      console.warn('⚠️ Stripe configuration incomplete - some features may not work');
   }
}

validateStripeConfig();

// =============================================================================
// CLIENTS
// =============================================================================

const resend = new Resend(process.env.RESEND_API_KEY);

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
   apiVersion: "2025-08-27.basil",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// =============================================================================
// AUTH CONFIG
// =============================================================================

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
            afterCreateOrganization: async ({ organization, user }) => {
               console.log(`[Organization] Created "${organization.name}" (${organization.id}) by ${user.email}`);
               trackServerEvent(user.id, "organization_created", organization.id, {
                  organization_name: organization.name,
               });
            },
            afterCreateInvitation: async ({ invitation, inviter, organization }) => {
               console.log(`[Invitation] Created for ${invitation.email} to org ${organization.id}`);
               trackServerEvent(inviter.id, "invitation_sent", organization.id, {
                  invitation_id: invitation.id,
                  invited_email: invitation.email,
                  role: invitation.role,
               });
            },
            afterAcceptInvitation: async ({ invitation, member, user, organization }) => {
               console.log(`[Invitation] ✅ Accepted by ${user.email} for org ${organization.id}`);
               trackServerEvent(user.id, "invitation_accepted", organization.id, {
                  invitation_id: invitation.id,
                  member_id: member.id,
                  role: member.role,
               });
            },
            afterRejectInvitation: async ({ invitation, user, organization }) => {
               console.log(`[Invitation] ❌ Rejected by ${user.email} for org ${organization.id}`);
               trackServerEvent(user.id, "invitation_rejected", organization.id, {
                  invitation_id: invitation.id,
               });
            },
            afterCancelInvitation: async ({ invitation, cancelledBy, organization }) => {
               console.log(`[Invitation] Canceled for ${invitation.email} by ${cancelledBy.email}`);
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

      // Stripe subscription plugin
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

                  if (referenceId) {
                     const trialEligible = await isTrialEligible(referenceId);
                     if (trialEligible) {
                        return {
                           params: { payment_method_collection: 'always' },
                        };
                     }
                  }

                  return {
                     params: { payment_method_collection: 'always' },
                  };
               }
               return { params: {} };
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
               console.log(`[Stripe] Subscription activated: ${subscription.id} on plan ${plan.name}`);
            },
            onSubscriptionCancel: async ({ subscription }) => {
               console.log(`[Stripe] Subscription canceled: ${subscription.id}`);
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
                  console.log(`[Auth] Auto-setting active org for user ${session.userId}: ${userMember.organizationId}`);
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