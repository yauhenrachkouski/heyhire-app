# Subscription Flow Documentation

## Overview

This document explains how subscriptions work in HeyHire, following the better-auth Stripe plugin patterns.

## Plans

- **pro**
  - Price: **$69/month**
  - Trial: **3 days**

## Important: Subscriptions are NOT Automatically Created

**Subscriptions are NOT created automatically when an organization is created.**

This is by design, according to better-auth Stripe plugin documentation. The subscription is tied to the organization through the `referenceId` field.

## Complete Flow

### 1. User Sign-Up and Authentication
- User signs in via Google OAuth or Magic Link
- User session is created
- No Stripe customer is created on sign-up
- Stripe customers are created/attached during subscription checkout for the organization

### 2. Onboarding (Organization Creation)
**File**: `src/app/onboarding/page.tsx`, `src/components/auth/onboarding-form.tsx`

- User completes onboarding form with organization details
- Server action `createOrganizationWithSetup()` is called
- Organization is created via better-auth API
- User is added as organization owner (member)
- Organization is set as active in user session
- **No subscription is created at this stage**

### 3. Subscription Selection
**File**: `src/app/paywall/page.tsx`, `src/components/subscribe/subscribe-cards.tsx`

- User is redirected to `/paywall` page
- User sees available plans (Pro)
- Trial eligibility is checked via `hasUsedTrial()` action
  - In code, trial is treated as "used" once the organization has any subscription record in the database
  - Users can only use trial once per organization

### 4. Checkout Initiation
**File**: `src/components/subscribe/subscribe-cards.tsx` (handleSelectPlan)

When user clicks "Start Trial" or "Get Started":
```typescript
await subscription.upgrade({
  plan: "pro",
  referenceId: activeOrganizationId, // Links subscription to organization
  successUrl: `${window.location.origin}/paywall/success`,
  cancelUrl: `${window.location.origin}/paywall`,
})
```

- `subscription.upgrade()` is called with the **organizationId as referenceId**
- better-auth creates a Stripe Checkout Session
- User is redirected to Stripe Checkout
- For `pro`: 3-day trial (if the organization is eligible)

### 5. Stripe Checkout
- User enters payment details on Stripe's hosted page
- Stripe processes the payment
- On success, user is redirected to `successUrl`

### 6. Webhook Processing
**Endpoint**: `POST /api/auth/stripe/webhook` (better-auth Stripe plugin)

**File**: `src/lib/auth.ts` (stripe plugin `onEvent` handler)

When Stripe sends webhooks:

**Better Auth (default sync)**
- `checkout.session.completed`
  - Syncs the internal `subscription` record after checkout (status, periods, trial dates, seats, stripe ids)
- `customer.subscription.updated`
  - Syncs subscription status/periods/seats and `cancelAtPeriodEnd`
- `customer.subscription.deleted`
  - Marks subscription as canceled

**Heyhire custom side-effects (via Better Auth `onEvent`)**
- `invoice.payment_succeeded`
  - Monthly credits reset (sets `organization.credits` to plan allocation)
- `invoice.payment_failed`
  - Sends payment failure email (does not revoke credits)
- `customer.subscription.trial_will_end`
  - Sends trial ending soon email

### 7. Subscription Verification
**File**: `src/actions/stripe.ts` (getUserSubscription)

The app queries subscriptions by organization:
```typescript
const subscription = await db.query.subscription.findFirst({
  where: eq(subscription.referenceId, activeOrgId)
})
```

## Database Schema

### Subscription Table
```typescript
{
  id: string
  plan: string                    // "pro"
  referenceId: string            // Organization ID (NOT user ID)
  stripeCustomerId: string       // Stripe customer ID
  stripeSubscriptionId: string   // Stripe subscription ID
  status: string                 // "trialing" | "active" | "canceled" etc.
  periodStart: Date
  periodEnd: Date
  trialStart: Date
  trialEnd: Date
  cancelAtPeriodEnd: boolean
  seats: number
}
```

## Key Points

### Linking Subscriptions to Organizations
- Subscriptions use `referenceId` field to link to organizations
- `referenceId` = organizationId (not userId)
- This allows organization-level subscriptions for team plans

### Org-Only Billing (No User Ownership)
- There is no personal/user subscription ownership in the app
- Subscription state is always resolved using the active organization ID from the session
- Billing actions (upgrade/cancel/restore/portal) are restricted to organization `owner` and `admin`

### Trial Management
- Trial is **3 days** for the **Pro** plan
- Trial is treated as "used" for an organization once a subscription record exists for that org
- Users cannot start a new trial for the same organization

### Subscription Gates
**File**: `src/actions/stripe.ts` (requireActiveSubscription)

Protected routes check subscription status:
- If no active subscription: redirect to `/paywall`
- Active statuses: `active`, `trialing`
- Organization-level check: uses active organizationId from session

## Server Actions

### `getUserSubscription()`
Fetches subscription for the active organization (by `subscription.referenceId = activeOrgId`).

### `requireActiveSubscription()`
Gate that redirects users without active subscriptions to `/paywall`.

### `hasUsedTrial()`
Checks if organization has already used their trial based on subscription history.

## Authorization

Per better-auth configuration (`authorizeReference` in `auth.ts`):
- User must be a member of the organization to access its subscription
- Only `owner` and `admin` roles can manage (create/modify) subscriptions
- Other members can view but not modify

## Environment Variables Required

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
```

## Troubleshooting

### "No subscription found"
- Verify organization exists and user is a member
- Check `referenceId` matches organizationId in subscription table
- Check Stripe webhook logs for processing errors

### "No organization" in sidebar
- Verify organization was created in database
- Check `member` table has user+org relationship with "owner" role
- Check session has `activeOrganizationId` set
- Review logs in `[DashboardLayout]` and `[OrgSwitcher]`

### Trial not working
- Check `hasUsedTrial()` logic and subscription status history
- Verify Stripe checkout includes trial_period_days
- Check webhook processed `customer.subscription.created` event


