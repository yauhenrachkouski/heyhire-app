import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, magicLink } from "better-auth/plugins";
import { db } from "@/db/drizzle";
import * as schema from "@/db/schema";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
      organization(),
      magicLink({
         sendMagicLink: async ({ email, url, token }, request) => {
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
      })
   ],
   rateLimit: {
      window: 60, // time window in seconds
      max: 10,
   },
})