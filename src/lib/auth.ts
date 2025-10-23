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

// Validate Stripe environment variables at startup
function validateStripeConfig() {
  const requiredVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'STRIPE_STARTER_PRICE_ID',
    'STRIPE_PRO_PRICE_ID',
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



export const auth = betterAuth({
   database: drizzleAdapter(db, {
      provider: "pg",
      schema,
   }),
   emailAndPassword: {
      enabled: false,
   },
   socialProviders: {
      google: {
         clientId: process.env.GOOGLE_CLIENT_ID as string,
         clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
         redirectUri: process.env.NEXT_PUBLIC_SITE_URL as string,
      },
   },
   plugins: [
      organization({
         async sendInvitationEmail(data) {
            const inviteLink = `${process.env.NEXT_PUBLIC_SITE_URL}/accept-invitation/${data.id}`;
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
                  name: "starter",
                  priceId: process.env.STRIPE_STARTER_PRICE_ID || "price_1SKbRLBFuK3GeesLncMInoVH",
                  limits: {
                     searches: 100,
                     candidates: 1000,
                  },
                  freeTrial: {
                     days: 3,
                     onTrialStart: async (subscription) => {
                        console.log(`Trial started for organization: ${subscription.referenceId}`);
                     },
                     onTrialEnd: async ({ subscription }) => {
                        console.log(`Trial ended for organization ${subscription.referenceId}, converting to Starter plan`);
                     },
                     onTrialExpired: async (subscription) => {
                        console.log(`Trial expired for organization ${subscription.referenceId}`);
                     },
                  },
               },
               {
                  name: "pro",
                  priceId: process.env.STRIPE_PRO_PRICE_ID || "price_1SKbQwBFuK3GeesLv8h5MIfA",
                  limits: {
                     searches: 500,
                     candidates: 5000,
                  },
                  freeTrial: {
                     days: 3,
                     onTrialStart: async (subscription) => {
                        console.log(`Pro trial started for organization: ${subscription.referenceId}`);
                     },
                     onTrialEnd: async ({ subscription }) => {
                        console.log(`Pro trial ended for organization ${subscription.referenceId}, converting to Pro plan`);
                     },
                  },
               },
            ],
            // Charge $3 for the trial period - use organization as reference
            getCheckoutSessionParams: async ({ user, session, plan, subscription }) => {
               // Only charge $3 for trial if it's Starter or Pro plan and no existing subscription
               if ((plan.name === "starter" || plan.name === "pro") && !subscription) {
                  return {
                     params: {
                        payment_method_collection: 'always',
                        subscription_data: {
                           trial_period_days: 3,
                        },
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
            before: async (user) => {
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
      
   },
   rateLimit: {
      window: 60, // time window in seconds
      max: 10,
   },
})

// Export stripeClient for use in server actions
export { stripeClient };