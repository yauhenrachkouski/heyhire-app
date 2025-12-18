# Stripe + Better Auth Architecture (Heyhire)

## Goal

Use Better Auth (`@better-auth/stripe`) as the **single source of truth** for subscription state in the database, while keeping Heyhire-specific business logic (credits, emails, analytics) in a small, auditable layer.

## Primary Principles

- **Better Auth native first**
  - Better Auth Stripe plugin owns subscription state sync and lifecycle.
  - We avoid duplicating subscription DB writes in our own webhook handlers.

- **Organization-based billing**
  - Subscriptions are linked to organizations via `referenceId`.
  - `referenceId` is always the Better Auth Organization `organization.id`.

- **Idempotency is explicit**
  - Stripe retries webhooks.
  - We record processed events/actions in DB to prevent duplicate emails/credit grants.

- **Single source of truth for limits**
  - Plan limits live in `src/types/plans.ts` (`PLAN_LIMITS`).
  - Better Auth plan `limits` and our credit allocation helpers both reference `PLAN_LIMITS`.

## Where subscription state is updated (Better Auth)

Better Auth Stripe plugin handles these events by default and updates the internal `subscription` table:

- `checkout.session.completed`
  - Syncs subscription details after checkout (status, period dates, trial dates, seats, stripeSubscriptionId)
  - Triggers `subscription.onSubscriptionComplete`
  - Triggers `freeTrial.onTrialStart` when trial is present

- `customer.subscription.updated`
  - Syncs status/period dates/seats/cancelAtPeriodEnd
  - Triggers `subscription.onSubscriptionUpdate`
  - Triggers `subscription.onSubscriptionCancel` when `cancel_at_period_end` flips to true
  - Triggers `freeTrial.onTrialEnd` and `freeTrial.onTrialExpired` depending on status transitions

- `customer.subscription.deleted`
  - Marks subscription as `canceled`
  - Triggers `subscription.onSubscriptionDeleted`

**We do not re-implement these sync steps in Heyhire.**

## Heyhire responsibilities (custom logic)

### Credits

Credits are stored on `organization.credits`.

- **Trial start**
  - Implemented in `src/lib/auth.ts` via Better Auth plan hook `freeTrial.onTrialStart`.
  - Behavior: set credits to trial allocation (reset-style), write `credit_transactions`.

- **Monthly reset**
  - Implemented in `src/lib/stripe/webhooks.ts` on `invoice.payment_succeeded`.
  - Behavior: set credits to plan allocation (reset-style), write `credit_transactions`.

- **Credits revoked (set to 0)**
  - Implemented in `src/lib/auth.ts` via Better Auth hooks:
    - `subscription.onSubscriptionDeleted`
    - `subscription.onSubscriptionUpdate` when status becomes `unpaid` or `incomplete_expired`
    - `freeTrial.onTrialExpired`

### Subscription management state (cancel/resume)

`cancelAtPeriodEnd` is treated as **Better Auth-owned state**.

- `src/actions/stripe.ts` calls Stripe to cancel/resume.
- We do **not** manually write `subscription.cancelAtPeriodEnd` in our DB.
- Better Auth updates it via webhook sync (`customer.subscription.updated`).

### Emails

- `customer.subscription.trial_will_end`
  - Implemented in `src/lib/stripe/webhooks.ts`.
  - Uses `TrialEndingSoonEmail`.

- `invoice.payment_failed`
  - Implemented in `src/lib/stripe/webhooks.ts`.
  - Sends a payment failure email.
  - **Does not** revoke credits (Stripe retries payments for weeks).

### Analytics

We track the key events in:
- Better Auth hooks (trial started / subscription ended)
- Stripe onEvent handler (invoice paid/failed, trial_will_end, risk signals)

## Idempotency & Source of Truth for processing

We use the DB table `stripe_webhook_events` to record processed events and synthetic billing actions.

- Migration: `migrations/0013_stripe_webhook_events.sql`
- Schema: `src/db/schema.ts` (`stripeWebhookEvents`)

Used for:
- Stripe event idempotency (`evt_...`) in `src/lib/stripe/webhooks.ts`
- Better Auth hook idempotency keys (e.g. `better_auth:trial_start:<subscriptionId>`) in `src/lib/auth.ts`

## Runtime validation (fail-fast)

We enforce that all checkout sessions include an organization reference:

- In `src/lib/auth.ts` `getCheckoutSessionParams`, if `referenceId` is missing we throw an error.

This prevents creating Stripe Checkout Sessions without the metadata necessary for reliable mapping.

## Notes

- `allowReTrialsForDifferentPlans`
  - This option was added in `src/lib/auth.ts`.
  - If TypeScript reports it as an unknown option for `@better-auth/stripe@^1.4.7`, remove it to stay fully aligned with the installed plugin version.

## Stripe events to subscribe to (recommended)

### Required for Better Auth subscription sync
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### Required for Heyhire custom logic
- `invoice.payment_succeeded` (monthly credits reset)
- `invoice.payment_failed` (email)
- `customer.subscription.trial_will_end` (email)

### Optional analytics / risk
- `invoice.upcoming`
- `customer.updated`
- `charge.refunded`
- `charge.dispute.created`

## Files of interest

- Better Auth configuration:
  - `src/lib/auth.ts`

- Custom Stripe event side-effects:
  - `src/lib/stripe/webhooks.ts`

- Subscription access & billing actions:
  - `src/actions/stripe.ts`

- Docs:
  - `docs/SUBSCRIPTION_FLOW.md`

## External references

- Better Auth Stripe plugin docs:
  - https://www.better-auth.com/docs/plugins/stripe
  - https://raw.githubusercontent.com/better-auth/better-auth/refs/heads/main/docs/content/docs/plugins/stripe.mdx

- Better Auth Organization plugin docs:
  - https://www.better-auth.com/docs/plugins/organization
  - https://raw.githubusercontent.com/better-auth/better-auth/refs/heads/main/docs/content/docs/plugins/organization.mdx

- Better Auth Stripe plugin implementation (source)
  - https://raw.githubusercontent.com/better-auth/better-auth/refs/heads/main/packages/stripe/src/hooks.ts
