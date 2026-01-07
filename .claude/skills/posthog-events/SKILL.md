---
name: posthog-events
description: Product manager skill for PostHog analytics strategy. Use when (1) adding new PostHog events, (2) reviewing event tracking coverage, (3) ensuring event naming consistency, (4) understanding user journey analytics, (5) debugging distinct_id or group association issues, (6) planning feature analytics, (7) implementing feature flags, (8) adding billing/subscription analytics to better-auth hooks. Provides event catalog, naming conventions, server-side tracking patterns, and feature flag guidelines for this Next.js + better-auth + Stripe codebase.
---

# PostHog Events Product Manager

Guide for maintaining consistent, actionable PostHog analytics in the Heyhire codebase.

## Core Principles

1. **Server-side preferred** - Track in server actions, API routes, and auth hooks for reliability
2. **Consistent distinct_id** - Always use `user.id` from database, never email or external IDs
3. **Organization grouping**:
   - **Server-side**: Pass `groups: { organization }` in every `capture()` call (no session persistence)
   - **Client-side**: Call `posthog.group()` once per session; all subsequent events auto-associate
4. **Idempotency** - Critical billing events must be deduplication-protected
5. **Minimal properties** - Don't pass `user_id` or `organization_id` as properties when already in distinct_id/groups

## Event Tracking Locations

| Location | Pattern | When to use |
|----------|---------|-------------|
| `src/lib/auth.ts` | `getPostHogServer().capture()` | Auth, org, subscription lifecycle |
| `src/lib/stripe/webhooks.ts` | `getPostHogServer().capture()` | Billing events from Stripe |
| `src/actions/*.ts` | `getPostHogServer().capture()` | Server actions (credits, contacts) |
| `src/app/api/**/*.ts` | `getPostHogServer().capture()` | API routes (scoring, workflows) |
| `src/components/*.tsx` | `posthog.capture()` | Client interactions (clicks, views) |

## Adding a New Event

### Server-side (preferred)

Server-side has no session persistence—pass `groups` in every call:

```typescript
import { getPostHogServer } from "@/lib/posthog/posthog-server";

const posthog = getPostHogServer();
posthog.capture({
  distinctId: userId,  // Always user.id from DB
  event: "feature_action_completed",
  groups: { organization: organizationId },  // Required for every server call
  properties: {
    // Only add properties that add analytical value
    // DO NOT include: user_id, organization_id (redundant)
    result_count: 10,
    duration_ms: 1234,
  },
});
```

### Client-side (for UI interactions)

`UserContextProvider` handles identity and groups automatically—just call `capture()`:

```typescript
import posthog from "posthog-js";

// UserContextProvider already called:
// - posthog.identify(userId, { email, name })  → sets distinct_id
// - posthog.group("organization", orgId)       → sets group context

posthog.capture("button_clicked", {
  button_name: "export_csv",
  search_id: searchId,
});
// ✅ distinct_id: auto-identified from session
// ✅ organization group: auto-associated from session
```

## Client-Side Identity Flow

`UserContextProvider` manages the full PostHog identity lifecycle:

```
Anonymous visitor → identify() → Authenticated user → reset() → New anonymous
```

### How it works (already implemented)

```typescript
// src/providers/user-context-provider.tsx

// 1. When user authenticates:
posthog.identify(userId, {
  email: session.user.email,
  name: session.user.name,
});
// → Merges anonymous events with authenticated user
// → All future events use userId as distinct_id

// 2. Set organization group:
posthog.group("organization", orgId, { name, slug });
// → All events auto-associate with this org

// 3. When user logs out:
posthog.reset();
// → Clears identity, generates new anonymous distinct_id
```

### What `identify()` does

- Merges the anonymous `distinct_id` with your `user.id`
- All previous anonymous events get linked to this user retroactively
- All future events use `user.id` as the `distinct_id`

### Important rules

- Call `identify()` **once per session** (on auth or app load if already authenticated)
- Call `reset()` on logout to start fresh anonymous tracking
- Don't call `identify()` on every page load—PostHog remembers

## Event Naming Convention

Format: `noun_verb_past` in snake_case

| Category | Pattern | Examples |
|----------|---------|----------|
| User lifecycle | `user_*` | `user_signed_up`, `user_signed_in`, `user_signed_out` |
| Organization | `organization_*`, `invitation_*` | `organization_created`, `invitation_sent` |
| Subscription | `subscription_*`, `trial_*` | `subscription_activated`, `trial_started` |
| Feature actions | `feature_action` | `search_created`, `candidate_details_viewed` |
| Errors/failures | `*_failed` | `linkedin_reveal_failed`, `invoice_payment_failed` |

## Person Properties Strategy

Set via `$set` for current state, `$set_once` for immutable data:

```typescript
posthog.capture({
  distinctId: userId,
  event: "$set",
  properties: {
    $set: {
      current_plan: "pro",
      subscription_status: "active",
    },
    $set_once: {
      first_plan: "pro",
      signed_up_at: new Date().toISOString(),
    },
  },
});
```

## Group Properties Strategy

Update organization group properties when subscription/plan changes:

```typescript
posthog.groupIdentify({
  groupType: "organization",
  groupKey: organizationId,
  properties: {
    name: org.name,
    current_plan: "pro",
    subscription_status: "active",
    credits_remaining: 100,
  },
});
```

## Feature Flags Integration

Feature flags are managed via PostHog. Follow these patterns:

### Client-side

```typescript
import { useFeatureFlagEnabled } from "posthog-js/react";

function MyComponent() {
  const isEnabled = useFeatureFlagEnabled("NEW_SEARCH_UI");
  // Gate feature on flag
}
```

### Server-side

```typescript
const posthog = getPostHogServer();
const isEnabled = await posthog.isFeatureEnabled("NEW_SEARCH_UI", userId);
```

### Flag naming rules (from `.cursor/rules/posthog-integration.mdc`)

- Store flag names in enums/const objects with `UPPERCASE_WITH_UNDERSCORE`
- Keep flag usage to minimum callsites—don't scatter same flag across codebase
- Gate flag-dependent code on value validation
- Consult existing naming conventions before creating new flags

## Better-Auth Stripe Integration Points

Analytics are tracked in better-auth hooks. Here's where to add new billing events:

| Hook | Location | Current Events |
|------|----------|----------------|
| `onTrialStart` | `src/lib/auth.ts` | `trial_started` |
| `onTrialExpired` | `src/lib/auth.ts` | `trial_expired` |
| `onSubscriptionUpdate` | `src/lib/auth.ts` | `subscription_activated`, `credits_reset`, `subscription_plan_changed` |
| `onSubscriptionCancel` | `src/lib/auth.ts` | `subscription_canceled` |
| `onSubscriptionDeleted` | `src/lib/auth.ts` | `subscription_deleted` |

**Stripe webhook handlers** (`src/lib/stripe/webhooks.ts`):

| Handler | Events |
|---------|--------|
| `handleTrialWillEnd` | `trial_will_end` |
| `handleInvoicePaymentSucceeded` | `subscription_invoice_paid`, `credits_reset` |
| `handleInvoicePaymentFailed` | `invoice_payment_failed` |
| `handleInvoiceUpcoming` | `invoice_upcoming` |

### Adding new billing analytics

```typescript
// In auth.ts subscription hooks:
onSubscriptionUpdate: async ({ event, subscription }) => {
  // ... existing logic ...

  const posthog = getPostHogServer();
  posthog.capture({
    distinctId: ownerId,
    event: "your_new_event",
    groups: { organization: referenceId },
    properties: { /* analytical data */ },
  });
}
```

## Server SDK Configuration

The Node.js SDK is configured in `src/lib/posthog/posthog-server.ts`:

```typescript
new PostHog(apiKey, {
  host: process.env.POSTHOG_HOST,
  flushAt: 1,        // Flush after every event (serverless-friendly)
  flushInterval: 0,  // No batching delay
  disabled: process.env.NODE_ENV === "development",
});
```

**Note**: `flushAt: 1` ensures events are sent immediately—important for serverless environments where the process may terminate.

## Reference Files

- **[references/events-catalog.md](references/events-catalog.md)** - Complete list of all 42+ events with properties
- **[references/tracking-guidelines.md](references/tracking-guidelines.md)** - Detailed patterns and anti-patterns

## Quick Checklist for New Events

- [ ] Event name follows `noun_verb_past` convention
- [ ] Server-side preferred over client-side
- [ ] Uses `user.id` as distinctId (not email)
- [ ] Groups handled correctly:
  - Server-side: pass `groups: { organization }` in every call
  - Client-side: rely on session (no need to pass groups)
- [ ] No redundant user_id/organization_id in properties
- [ ] Billing events have idempotency protection
- [ ] Properties provide analytical value (not debugging data)
