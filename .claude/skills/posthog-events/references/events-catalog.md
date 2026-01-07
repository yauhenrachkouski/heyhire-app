# PostHog Events Catalog

Complete inventory of all tracked events in Heyhire. Use this as reference when adding new events or auditing coverage.

## Table of Contents

1. [User Lifecycle](#user-lifecycle)
2. [Organization Management](#organization-management)
3. [Subscription & Billing](#subscription--billing)
4. [Onboarding](#onboarding)
5. [Search & Sourcing](#search--sourcing)
6. [Candidate Interactions](#candidate-interactions)
7. [Contact Reveal & Credits](#contact-reveal--credits)
8. [Account Management](#account-management)

---

## User Lifecycle

### user_signed_up
- **Location**: `src/lib/auth.ts` (databaseHooks.user.create.after)
- **distinctId**: `user.id`
- **Properties**: `email_domain`
- **Trigger**: New user created in database

### user_signed_in
- **Location**: `src/lib/auth.ts` (databaseHooks.session.create.after)
- **distinctId**: `session.userId`
- **Properties**: `auth_method` (google/magiclink/unknown)
- **Trigger**: Session created

### user_signed_out
- **Location**: `src/lib/auth.ts` (databaseHooks.session.delete.before)
- **distinctId**: `session.userId`
- **Groups**: `organization` (if activeOrgId exists)
- **Properties**: `session_id`, `organization_id`
- **Trigger**: Session deleted

---

## Organization Management

### organization_created
- **Location**: `src/lib/auth.ts` (organizationHooks.afterCreateOrganization)
- **distinctId**: `user.id`
- **Groups**: `organization`
- **Properties**: `organization_id`, `organization_name`
- **Trigger**: New organization created

### organization_switched
- **Location**: `src/providers/user-context-provider.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `from_organization_id`, `to_organization_id`
- **Trigger**: User switches active organization

### invitation_sent
- **Location**: `src/lib/auth.ts` (organizationHooks.afterCreateInvitation)
- **distinctId**: `inviter.id`
- **Groups**: `organization`
- **Properties**: `organization_id`, `invitation_id`, `invited_email`, `role`

### invitation_accepted
- **Location**: `src/lib/auth.ts` (organizationHooks.afterAcceptInvitation)
- **distinctId**: `user.id`
- **Groups**: `organization`
- **Properties**: `organization_id`, `invitation_id`, `member_id`, `role`

### invitation_rejected
- **Location**: `src/lib/auth.ts` (organizationHooks.afterRejectInvitation)
- **distinctId**: `user.id`
- **Groups**: `organization`
- **Properties**: `organization_id`, `invitation_id`

### invitation_canceled
- **Location**: `src/lib/auth.ts` (organizationHooks.afterCancelInvitation)
- **distinctId**: `cancelledBy.id`
- **Groups**: `organization`
- **Properties**: `organization_id`, `invitation_id`, `invited_email`

---

## Subscription & Billing

### trial_started
- **Location**: `src/lib/auth.ts` (stripe.subscription.plans.freeTrial.onTrialStart)
- **distinctId**: `ownerId` (org owner)
- **Groups**: `organization`
- **Properties**: `organization_id`, `internal_subscription_id`, `stripe_customer_id`
- **Idempotency**: `better_auth:trial_start:${subscription.id}`

### trial_will_end
- **Location**: `src/lib/stripe/webhooks.ts` (handleTrialWillEnd)
- **distinctId**: `ownerId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `stripe_subscription_id`, `trial_end`
- **Trigger**: Stripe webhook `customer.subscription.trial_will_end`

### trial_expired
- **Location**: `src/lib/auth.ts` (via revokeOrgCreditsToZero)
- **distinctId**: `ownerId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `internal_subscription_id`
- **Idempotency**: `better_auth:trial_expired:${subscription.id}`

### subscription_activated
- **Location**: `src/lib/auth.ts` (onSubscriptionUpdate, when trialing→active)
- **distinctId**: `ownerId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `internal_subscription_id`, `plan`, `stripe_subscription_id`

### subscription_plan_changed
- **Location**: `src/lib/auth.ts` (onSubscriptionUpdate)
- **distinctId**: `owner.userId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `internal_subscription_id`, `from_price_id`, `to_price_id`, `to_plan`, `stripe_subscription_id`

### subscription_canceled
- **Location**: `src/lib/auth.ts` (onSubscriptionCancel)
- **distinctId**: `owner.userId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `internal_subscription_id`, `stripe_subscription_id`, `plan`

### subscription_deleted
- **Location**: `src/lib/auth.ts` (onSubscriptionDeleted, via revokeOrgCreditsToZero)
- **distinctId**: `ownerId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `internal_subscription_id`
- **Idempotency**: `better_auth:subscription_deleted:${subscription.id}`

### credits_reset
- **Location**: `src/lib/stripe/webhooks.ts` (handleInvoicePaymentSucceeded)
- **distinctId**: `ownerId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `internal_subscription_id`, `plan`, `period_start`, `stripe_invoice_id`
- **Idempotency**: `better_auth:credits_reset:${subscriptionId}:${periodStartKey}`

### subscription_invoice_paid
- **Location**: `src/lib/stripe/webhooks.ts` (handleInvoicePaymentSucceeded)
- **distinctId**: `ownerId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `internal_subscription_id`, `plan`, `stripe_invoice_id`

### invoice_payment_failed
- **Location**: `src/lib/stripe/webhooks.ts` (handleInvoicePaymentFailed)
- **distinctId**: `ownerId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `internal_subscription_id`, `stripe_invoice_id`, `stripe_subscription_id`, `plan`

### invoice_upcoming
- **Location**: `src/lib/stripe/webhooks.ts` (handleInvoiceUpcoming)
- **distinctId**: `ownerId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `stripe_invoice_id`, `stripe_customer_id`, `amount_due`, `next_payment_attempt`

### customer_updated
- **Location**: `src/lib/stripe/webhooks.ts` (handleCustomerUpdated)
- **distinctId**: `ownerId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `stripe_customer_id`, `email`

### stripe_payment_risk_event
- **Location**: `src/lib/stripe/webhooks.ts` (handlePaymentRiskEvent)
- **distinctId**: `ownerId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `stripe_charge_id`, `stripe_customer_id`, `amount`, `reason`
- **Trigger**: `charge.refunded` or `charge.dispute.created`

### checkout_initiated
- **Location**: `src/components/subscribe/subscribe-checkout-button.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `plan`, `organization_id`
- **Trigger**: User clicks checkout button

### paywall_viewed
- **Location**: `src/app/paywall/page.tsx`
- **distinctId**: `session.user.id`
- **Properties**: `is_trial_eligible`
- **Trigger**: Server-side page load

### billing_portal_payment_method_session_created
- **Location**: `src/actions/stripe.ts`
- **distinctId**: `userId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `stripe_customer_id`

---

## Onboarding

### onboarding_started
- **Location**: `src/app/onboarding/page.tsx`
- **distinctId**: `session.user.id`
- **Properties**: `has_name`, `email_domain`
- **Trigger**: Server-side page load

### onboarding_completed
- **Location**: `src/components/auth/onboarding-form.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `organization_name`, `organization_size`, `included_demo_workspace`, `method` (submit/skip)

---

## Search & Sourcing

### search_created
- **Location**: `src/app/[org]/(protected)/search/search-client.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `search_id`, `organization_id`, `workflow_run_id`, `source` (manual/autorun), `query_text_length`

### search_autorun_triggered
- **Location**: `src/app/[org]/(protected)/search/search-client.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `search_id`, `organization_id`, `query_text`, `query_text_length`

### search_scoring_completed
- **Location**: `src/app/api/scoring/candidate/route.ts`
- **distinctId**: `userId` (from search record)
- **Groups**: `organization` (if available)
- **Properties**: `search_id`, `organization_id`, `candidates_scored`, `scoring_errors`, `total_candidates`

---

## Candidate Interactions

### candidate_details_viewed
- **Location**: `src/components/search/candidate-card-list-infinite.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `search_id`, `organization_id`, `candidate_id`

### candidates_exported
- **Location**: `src/components/search/candidate-card-action-bar.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `search_id`, `organization_id`, `candidate_count`, `export_format`

### candidates_select_all
- **Location**: `src/components/search/candidate-card-action-bar.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `search_id`, `organization_id`, `previously_selected_count`

### candidates_deselect_all
- **Location**: `src/components/search/candidate-card-action-bar.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `search_id`, `organization_id`, `deselected_count`

---

## Contact Reveal & Credits

### linkedin_revealed
- **Location**: `src/actions/consumption.ts`
- **distinctId**: `userId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `candidate_id`, `linkedin_url`, `credit_cost`

### linkedin_reveal_failed
- **Location**: `src/hooks/use-open-linkedin-with-credits.ts`
- **distinctId**: Auto-identified (client)
- **Properties**: `candidate_id`, `error`

### contact_reveal_failed
- **Location**: `src/hooks/use-reveal-contact.ts`
- **distinctId**: Auto-identified (client)
- **Properties**: `candidate_id`, `type` (email/phone/both), `error`

### credits_consumed
- **Location**: `src/actions/consumption.ts`
- **distinctId**: `userId`
- **Groups**: `organization`
- **Properties**: `organization_id`, `action`, `candidate_id`, `linkedin_url`, `credit_type`, `credit_amount`, `credit_transaction_id`, `credits_before`, `credits_after`

---

## Account Management

### profile_updated
- **Location**: `src/components/account/profile-form.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `success`, `error`, `from_name`, `to_name`

### avatar_uploaded
- **Location**: `src/components/account/profile-form.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `success`, `file_size`, `file_type`, `error`, `from_has_avatar`, `to_has_avatar`

### avatar_removed
- **Location**: `src/components/account/profile-form.tsx`
- **distinctId**: Auto-identified (client)
- **Properties**: `success`, `error`, `from_has_avatar`, `to_has_avatar`

---

## Person Properties (via $set)

These are set as person properties, not standalone events:

| Property | Type | Set Location | Description |
|----------|------|--------------|-------------|
| `email` | $set | auth.ts, user-context | User's email |
| `name` | $set | auth.ts, user-context | User's display name |
| `current_plan` | $set | auth.ts, user-context | Active plan (pro/none) |
| `subscription_status` | $set | auth.ts, user-context | active/canceled/trialing |
| `is_trialing` | $set | auth.ts, user-context | Boolean |
| `credits_remaining` | $set | user-context | Current credit balance |
| `last_auth_method` | $set | auth.ts | Last login method |
| `is_anonymous` | $set | user-context | Demo user flag |
| `first_organization_id` | $set_once | auth.ts | First org created |
| `first_organization_name` | $set_once | auth.ts | First org name |
| `stripe_customer_id` | $set_once | auth.ts | Stripe customer link |
| `trial_started_at` | $set_once | auth.ts | Trial start timestamp |
| `first_plan` | $set_once | auth.ts | First subscribed plan |
| `first_auth_method` | $set_once | auth.ts | First login method |
| `first_seen_at` | $set_once | auth.ts | First session timestamp |
| `user_db_id` | $set_once | auth.ts | Database user ID |
| `first_email` | $set_once | auth.ts | Original email |
| `signed_up_at` | $set_once | auth.ts | Registration timestamp |
| `email_domain` | $set_once | auth.ts | Email domain |

---

## Organization Group Properties

Set via `posthog.groupIdentify()`:

| Property | Set Location | Description |
|----------|--------------|-------------|
| `name` | auth.ts, user-context | Org display name |
| `slug` | auth.ts, user-context | URL slug |
| `created_at` | auth.ts | Creation timestamp |
| `creator_user_id` | auth.ts | Founding user |
| `stripe_customer_id` | auth.ts | Stripe link |
| `stripe_subscription_id` | auth.ts | Subscription link |
| `current_plan` | auth.ts, user-context | Active plan |
| `is_trialing` | auth.ts, user-context | Trial status |
| `subscription_status` | auth.ts, user-context | Subscription state |
| `credits_remaining` | user-context | Credit balance |
