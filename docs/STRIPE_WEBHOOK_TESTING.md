# Stripe Webhook Testing (Local)

This document describes how to test Stripe webhooks locally and verify that:
- Stripe webhook delivery + signature verification works
- Heyhire webhook side-effects run (emails via Resend, analytics via PostHog, credits)

## What handles webhooks in this repo

- Webhook endpoint: `POST /api/auth/stripe/webhook` (Better Auth)
- Next route handler: `src/app/api/auth/[...all]/route.ts`
- Better Auth Stripe plugin config: `src/lib/auth.ts`
- Heyhire side-effects handler: `src/lib/stripe/webhooks.ts` (`handleStripeEvent`)

## Prerequisites

- Stripe CLI installed and authenticated: `stripe login`
- `.env.local` configured (at minimum):
  - `STRIPE_SECRET_KEY=...` (test mode key for local)
  - `STRIPE_WEBHOOK_SECRET=...` (from `stripe listen`, see below)
  - `DATABASE_URL=...` (your dev DB)
  - `RESEND_API_KEY=...` and `EMAIL_FROM=...` (for email tests)
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
  - PostHog env vars used by your setup (if you want to verify analytics)

## Start local dev + webhook forwarding

### Option A: run everything

```bash
bun run dev:all
```

This runs:
- Next dev server
- Stripe CLI webhook forwarder
- Cloudflared tunnel (optional)


## Basic webhook smoke test (delivery + signature)

Trigger any event and confirm you get `200` responses in the Stripe CLI output:

```bash
stripe trigger customer.updated
```

Expected:
- Stripe CLI shows ` <-- [200] POST http://localhost:3000/api/auth/stripe/webhook ...`
- App logs show `Webhook received` and `Event processing complete`

## Testing emails (Resend)

### Email sources in this repo

Webhook-driven emails (in `src/lib/stripe/webhooks.ts`):
- `customer.subscription.trial_will_end` -> `TrialEndingSoonEmail`
- `invoice.payment_failed` -> `PaymentFailedEmail`

Action-driven emails (in `src/actions/stripe.ts`):
- `cancelSubscription()` -> `SubscriptionCanceledEmail`
- `resumeSubscription()` -> `SubscriptionActivatedEmail`

### How to verify emails

- Check the Resend dashboard for sent emails
- Confirm app logs do not show warnings like `Failed to send ... email`

### Important limitation when using `stripe trigger`

Some `stripe trigger ...` fixtures do NOT include the subscription metadata Heyhire relies on (`metadata.referenceId`), and invoices may not include a `subscription` id.

That means:
- The webhook may return `200`
- But the email may not send because the handler can’t map the Stripe object back to an organization.

## Testing analytics (PostHog)

Your webhook handler calls `getPostHogServer().capture(...)` in multiple places.

To verify:
- Watch your PostHog events (project dashboard)
- Filter for events emitted by webhooks (examples in code):
  - `stripe_webhook_received`
  - `invoice_upcoming`
  - `customer_updated`
  - `trial_will_end`
  - `subscription_invoice_paid`

## Recommended end-to-end test (fully exercises emails + credits)

To properly test emails + credits, you need a real Stripe subscription created by your app so metadata is present.

### 1) Create a subscription via the app

- Start the checkout from `/paywall`
- Complete the checkout in Stripe test mode

This ensures Better Auth sets:
- `subscription_data.metadata.referenceId` (organization id)
- `metadata.referenceId` on the created Stripe subscription

### 2) Test invoice events (credits + payment failed email)

In Stripe dashboard (test mode):
- Locate the subscription
- Trigger invoice generation/payment (or advance a test clock if you use it)

Expected webhook behaviors:
- `invoice.payment_succeeded`
  - Credits reset via `grantPlanCreditsWithTransaction(...)`
  - Idempotency record inserted into `stripe_webhook_events`
- `invoice.payment_failed`
  - `PaymentFailedEmail` sent

### 3) Test trial ending email

With a real trialing subscription, Stripe will emit:
- `customer.subscription.trial_will_end`

Expected:
- `TrialEndingSoonEmail` sent

## Troubleshooting

### Symptom: Stripe CLI shows `dial tcp ... connect: connection refused`

- Next dev is not running on the port you forward to.
- Fix: ensure Next is on `http://localhost:3000` or update the forward-to URL.

### Symptom: `No signatures found matching the expected signature`

- `STRIPE_WEBHOOK_SECRET` in `.env.local` does not match the `whsec_...` from `stripe listen`.
- Fix: copy the current `whsec_...` into `.env.local` and restart Next.

### Symptom: DB errors querying `stripe_webhook_events`

- The table is missing in the current database.
- Fix:
  - `bun run db:migrate`
  - or (dev-only) `bun run db:push`

### Symptom: Webhook returns `200` but credits/emails don’t happen

- The Stripe object couldn’t be mapped to an internal subscription/org because:
  - invoice is missing a `subscription` id
  - or subscription is missing `metadata.referenceId`
- Fix: run the recommended end-to-end test via app checkout.
