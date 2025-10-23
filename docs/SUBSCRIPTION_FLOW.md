# Subscription Flow Documentation

## Overview

This document explains how subscriptions work in HeyHire, following the better-auth Stripe plugin patterns.

## Important: Subscriptions are NOT Automatically Created

**Subscriptions are NOT created automatically when an organization is created.**

This is by design, according to better-auth Stripe plugin documentation. The subscription is tied to the organization through the `referenceId` field.

## Complete Flow

### 1. User Sign-Up and Authentication
- User signs in via Google OAuth or Magic Link
- User session is created
- Stripe customer is created automatically (via `createCustomerOnSignUp: true`)

### 2. Onboarding (Organization Creation)
**File**: `src/app/onboarding/page.tsx`, `src/components/auth/onboarding-form.tsx`

- User completes onboarding form with organization details
- Server action `createOrganizationWithSetup()` is called
- Organization is created via better-auth API
- User is added as organization owner (member)
- Organization is set as active in user session
- **No subscription is created at this stage**

### 3. Subscription Selection
**File**: `src/app/subscribe/page.tsx`, `src/components/subscribe/subscribe-cards.tsx`

- User is redirected to `/subscribe` page
- User sees available plans (Starter, Pro, Enterprise)
- Trial eligibility is checked via `hasUsedTrial()` action
  - Trial is marked as "used" when any subscription reaches `trialing`, `active`, or `past_due` status
  - Users can only use trial once per organization

### 4. Checkout Initiation
**File**: `src/components/subscribe/subscribe-cards.tsx` (handleSelectPlan)

When user clicks "Start Trial" or "Get Started":
```typescript
await subscription.upgrade({
  plan: "starter" | "pro",
  referenceId: activeOrganizationId, // Links subscription to organization
  successUrl: `${window.location.origin}/subscribe/success`,
  cancelUrl: `${window.location.origin}/subscribe`,
})
```

- `subscription.upgrade()` is called with the **organizationId as referenceId**
- better-auth creates a Stripe Checkout Session
- User is redirected to Stripe Checkout
- For trial plans: 3-day trial with immediate $3 charge

### 5. Stripe Checkout
- User enters payment details on Stripe's hosted page
- Stripe processes the payment
- On success, user is redirected to `successUrl`

### 6. Webhook Processing
**File**: `src/lib/auth.ts` (onEvent handler)

When Stripe sends webhooks:

**Event: `customer.subscription.created`**
- better-auth plugin creates subscription record in database
- Fields set: `referenceId` (organizationId), `stripeCustomerId`, `stripeSubscriptionId`, `status`, etc.

**Event: `customer.subscription.updated`**
- Updates subscription status, trial dates, period dates

**Event: `invoice.payment_succeeded`**
- Marks subscription as `active`

**Event: `invoice.payment_failed`**
- Marks subscription as `past_due`

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
  plan: string                    // "starter" | "pro"
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

### Fallback for Legacy Subscriptions
If a subscription isn't found by organizationId, the system falls back to checking by `stripeCustomerId` from the user record. This handles legacy user-level subscriptions.

### Trial Management
- Trial is 3 days for both Starter and Pro plans
- Users pay $3 to start the trial
- After trial ends, regular monthly billing begins
- Trial is marked as "used" for an organization once any subscription reaches active/trialing status
- Users cannot start a new trial for the same organization

### Subscription Gates
**File**: `src/actions/stripe.ts` (requireActiveSubscription)

Protected routes check subscription status:
- If no active subscription: redirect to `/subscribe`
- Active statuses: `active`, `trialing`
- Organization-level check: uses active organizationId from session

## Server Actions

### `getUserSubscription()`
Fetches subscription for the active organization, with fallback to user's Stripe customer.

### `requireActiveSubscription()`
Gate that redirects users without active subscriptions to `/subscribe`.

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
STRIPE_STARTER_PRICE_ID=price_...
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

