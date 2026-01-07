# PostHog Tracking Guidelines

Detailed patterns and anti-patterns for consistent event tracking.

## Table of Contents

1. [Server vs Client Tracking](#server-vs-client-tracking)
2. [distinct_id Strategy](#distinct_id-strategy)
3. [Organization Group Analytics](#organization-group-analytics)
4. [Idempotency for Critical Events](#idempotency-for-critical-events)
5. [Property Best Practices](#property-best-practices)
6. [Feature Flags](#feature-flags)
7. [User Journey Funnels](#user-journey-funnels)
8. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)

---

## Server vs Client Tracking

### When to use server-side

| Scenario | Why |
|----------|-----|
| Auth events | Reliable, can't be blocked |
| Billing/subscription | Critical, needs idempotency |
| Credit transactions | Financial accuracy |
| Webhook handlers | No client context |
| Server actions | Already on server |

### When to use client-side

| Scenario | Why |
|----------|-----|
| UI interactions | Click, hover, scroll |
| Page views (SPA transitions) | Client routing |
| Form interactions | Immediate feedback |
| Feature discovery | UI element visibility |

### Server-side pattern

```typescript
// In server action or API route
import { getPostHogServer } from "@/lib/posthog/posthog-server";

export async function myServerAction() {
  const session = await getSession();
  const activeOrg = await getActiveOrganization();

  // ... do work ...

  const posthog = getPostHogServer();
  posthog.capture({
    distinctId: session.user.id,
    event: "action_completed",
    groups: { organization: activeOrg.id },
    properties: {
      result: "success",
    },
  });
}
```

### Client-side pattern

```typescript
// In React component
import posthog from "posthog-js";

function MyComponent() {
  const handleClick = () => {
    posthog.capture("button_clicked", {
      button_name: "submit",
    });
    // Note: distinctId and groups auto-set by UserContextProvider
  };
}
```

---

## distinct_id Strategy

### The Rule

**Always use `user.id` from the database as distinct_id.**

This ensures:
- Consistent identity across server and client
- Proper user merge if they sign in from multiple devices
- Accurate funnel analysis

### Client-side: Identity Flow

PostHog generates an anonymous `distinct_id` for visitors. When they authenticate, call `identify()` to merge:

```
┌─────────────────┐     identify()     ┌─────────────────┐
│ Anonymous User  │ ────────────────→  │ Authenticated   │
│ distinct_id:    │                    │ distinct_id:    │
│ "abc123-anon"   │                    │ "user_456"      │
└─────────────────┘                    └─────────────────┘
        ↓                                      ↓
  Events tracked                         All events
  before login                           linked together
```

**`UserContextProvider` handles this automatically:**

```typescript
// src/providers/user-context-provider.tsx

// On authentication:
if (userId && session?.user?.email) {
  posthog.identify(userId, {
    email: session.user.email,
    name: session.user.name,
  });
}

// On logout:
else {
  posthog.reset();
}
```

### What each method does

| Method | When to call | What it does |
|--------|--------------|--------------|
| `identify(userId, props)` | After login/signup, or on app load if authenticated | Merges anonymous → authenticated, sets distinct_id |
| `reset()` | After logout | Clears identity, generates new anonymous distinct_id |
| `alias(newId, oldId)` | Rarely needed | Merges two known user IDs (edge case) |

### Important: Don't over-identify

```typescript
// ❌ Don't call identify on every page/render
useEffect(() => {
  posthog.identify(userId);  // Wrong! Redundant calls
}, []);

// ✅ UserContextProvider handles this with proper deps
useEffect(() => {
  if (userId && session?.user?.email) {
    posthog.identify(userId, { email, name });
  }
}, [userId, session?.user?.email, session?.user?.name]);
```

### Server-side: No identity persistence

Server-side has no session—always pass `distinctId` explicitly:

```typescript
// Server-side: use user ID from session/database
posthog.capture({
  distinctId: session.user.id,  // ✅ Database ID
  event: "search_created",
});

// Server-side: use owner ID for org-level events
const owner = await db.query.member.findFirst({
  where: and(
    eq(schema.member.organizationId, orgId),
    eq(schema.member.role, "owner")
  ),
});
posthog.capture({
  distinctId: owner.userId,  // ✅ Database ID
  event: "subscription_activated",
});
```

### Wrong examples

```typescript
// ❌ Don't use email as distinct_id
posthog.capture({
  distinctId: user.email,  // Wrong!
  event: "user_signed_up",
});

// ❌ Don't use Stripe customer ID
posthog.capture({
  distinctId: stripeCustomerId,  // Wrong!
  event: "subscription_activated",
});

// ❌ Don't use session ID
posthog.capture({
  distinctId: session.id,  // Wrong!
  event: "page_viewed",
});
```

---

## Organization Group Analytics

### Why groups matter

Groups enable:
- Company-level analytics (not just user-level)
- Account-based funnels
- Org cohort comparison
- B2B metrics (ARR per org, etc.)

### Server-side vs Client-side Groups

**Critical distinction:**

| Context | Group Persistence | How to handle |
|---------|-------------------|---------------|
| **Client-side** | Session-persistent (cookie/localStorage) | Call `posthog.group()` once; all events auto-associate |
| **Server-side** | No persistence | Pass `groups: {}` in every `capture()` call |

### Client-side: Set once per session

```typescript
// UserContextProvider does this once when org loads/changes:
posthog.group("organization", orgId, { name, slug });

// All subsequent events auto-associate with the group:
posthog.capture("search_created");        // ✅ linked to org
posthog.capture("candidate_exported");    // ✅ linked to org
// No need to pass groups: {} in each call!
```

### Server-side: Pass in every call

```typescript
// Server has no session—must pass groups every time:
const posthog = getPostHogServer();
posthog.capture({
  distinctId: userId,
  event: "search_created",
  groups: { organization: orgId },  // ← Required every time
  properties: { ... },
});
```

### Identifying groups (setting group properties)

Use `groupIdentify` to set/update group properties (works same on both client and server):

```typescript
// Server-side: when org created or subscription changes
posthog.groupIdentify({
  groupType: "organization",
  groupKey: orgId,
  properties: {
    name: org.name,
    current_plan: "pro",
    subscription_status: "active",
  },
});

// Client-side: UserContextProvider also syncs properties
posthog.group("organization", orgId, {
  plan: sub.plan,
  credits_remaining: credits,
});
```

---

## Idempotency for Critical Events

### Why idempotency matters

Webhooks can be delivered multiple times. Without idempotency:
- Credits might be granted twice
- Duplicate events pollute analytics
- Financial reports become inaccurate

### Pattern: Event deduplication

```typescript
async function handleCriticalEvent(event) {
  const key = `event_type:${uniqueIdentifier}`;

  // Check if already processed
  if (await isBillingActionProcessed(key)) {
    log.info("event.duplicate", { key });
    return;
  }

  // Do the work
  await performAction();

  // Track the event
  posthog.capture({ ... });

  // Mark as processed
  await markBillingActionProcessed({
    key,
    type: "event_type",
    referenceId: orgId,
  });
}
```

### Idempotency key patterns

| Event | Key Pattern |
|-------|-------------|
| Trial start | `better_auth:trial_start:${subscription.id}` |
| Trial expired | `better_auth:trial_expired:${subscription.id}` |
| Credits reset | `better_auth:credits_reset:${subscriptionId}:${periodStartKey}` |
| Subscription deleted | `better_auth:subscription_deleted:${subscription.id}` |

---

## Property Best Practices

### DO include

| Property Type | Example | Why |
|---------------|---------|-----|
| Counts | `candidate_count: 10` | Quantitative analysis |
| Durations | `duration_ms: 1234` | Performance tracking |
| Categories | `export_format: "csv"` | Segmentation |
| Results | `success: true` | Funnel analysis |
| Feature flags | `experiment_variant: "a"` | A/B test attribution |

### DON'T include

| Property | Why Not |
|----------|---------|
| `user_id` | Already in distinct_id |
| `organization_id` | Already in groups |
| `email` | PII, already in person properties |
| `timestamp` | PostHog adds this automatically |
| Debug data | `request_body`, `stack_trace` |

### Correct property example

```typescript
posthog.capture({
  distinctId: userId,
  event: "search_completed",
  groups: { organization: orgId },
  properties: {
    search_id: searchId,
    candidates_found: 42,
    duration_ms: 3200,
    source: "manual",
    // ❌ NOT: user_id, organization_id, timestamp
  },
});
```

---

## Feature Flags

PostHog feature flags enable gradual rollouts and A/B testing.

### Client-side usage

```typescript
import { useFeatureFlagEnabled, useFeatureFlagPayload } from "posthog-js/react";

function MyComponent() {
  // Boolean check
  const isEnabled = useFeatureFlagEnabled("NEW_SEARCH_UI");

  // Get payload (for multivariate flags)
  const variant = useFeatureFlagPayload("SEARCH_EXPERIMENT");

  if (!isEnabled) return <OldUI />;
  return <NewUI variant={variant} />;
}
```

### Server-side usage

```typescript
const posthog = getPostHogServer();

// Async check (makes API call)
const isEnabled = await posthog.isFeatureEnabled("NEW_SEARCH_UI", userId);

// With groups (for org-level flags)
const isEnabled = await posthog.isFeatureEnabled("NEW_SEARCH_UI", userId, {
  groups: { organization: orgId },
});
```

### Naming conventions

From `.cursor/rules/posthog-integration.mdc`:

```typescript
// ✅ Use enums/const objects with UPPERCASE_WITH_UNDERSCORE
const FEATURE_FLAGS = {
  NEW_SEARCH_UI: "new_search_ui",
  CREDIT_LIMIT_WARNING: "credit_limit_warning",
} as const;

// ❌ Don't scatter string literals
if (posthog.isFeatureEnabled("new_search_ui")) // Bad
```

### Best practices

| Do | Don't |
|----|-------|
| Use minimum callsites per flag | Scatter same flag across codebase |
| Store flag names in constants | Use string literals |
| Gate code on value validation | Assume flag exists |
| Remove flag code after rollout | Leave dead flag checks |

### Tracking flag exposure

PostHog auto-tracks `$feature_flag_called` events. For custom tracking:

```typescript
posthog.capture("feature_used", {
  $feature_flag: "NEW_SEARCH_UI",
  $feature_flag_response: isEnabled,
});
```

---

## User Journey Funnels

### Signup → Activation Funnel

1. `user_signed_up` - Account created
2. `onboarding_started` - Started onboarding
3. `onboarding_completed` - Finished onboarding
4. `organization_created` - Created first org
5. `search_created` - First search (activation!)

### Trial → Conversion Funnel

1. `trial_started` - Started trial
2. `search_created` - Used core feature
3. `candidate_details_viewed` - Engaged with results
4. `linkedin_revealed` - Consumed credits
5. `checkout_initiated` - Started payment
6. `subscription_activated` - Converted!

### Retention Signals

Track these to measure engagement:
- `search_created` - Weekly active
- `candidate_details_viewed` - Deep engagement
- `candidates_exported` - Value extraction
- `credits_consumed` - Feature usage

---

## Anti-Patterns to Avoid

### 1. Tracking too granularly

```typescript
// ❌ Don't track every keystroke
posthog.capture("search_input_changed", { value: e.target.value });

// ✅ Track meaningful actions
posthog.capture("search_submitted", { query_length: query.length });
```

### 2. Inconsistent naming

```typescript
// ❌ Inconsistent naming
posthog.capture("searchCreated");      // camelCase
posthog.capture("Search Created");     // Title Case
posthog.capture("SEARCH_CREATED");     // SCREAMING_CASE

// ✅ Consistent snake_case
posthog.capture("search_created");
```

### 3. Missing group context (server-side)

```typescript
// ❌ Server-side without groups (no session persistence!)
const posthog = getPostHogServer();
posthog.capture({
  distinctId: userId,
  event: "search_created",
  // Missing: groups: { organization: orgId }
});

// ✅ Server-side with groups
posthog.capture({
  distinctId: userId,
  event: "search_created",
  groups: { organization: orgId },
});

// ✅ Client-side: groups auto-associated (set by UserContextProvider)
posthog.capture("search_created");  // Already linked to org via session
```

### 4. Client tracking for critical events

```typescript
// ❌ Client-side for billing
posthog.capture("subscription_activated");  // Could be blocked!

// ✅ Server-side for billing
getPostHogServer().capture({
  distinctId: ownerId,
  event: "subscription_activated",
  groups: { organization: orgId },
});
```

### 5. Duplicate tracking

```typescript
// ❌ Tracking same event in client and server
// Client:
posthog.capture("search_created");
// Server:
getPostHogServer().capture({ event: "search_created" });

// ✅ Pick one location (prefer server)
```

### 6. PII in properties

```typescript
// ❌ Including PII
posthog.capture({
  event: "profile_updated",
  properties: {
    email: user.email,           // PII!
    phone: user.phone,           // PII!
    full_name: user.name,        // PII!
  },
});

// ✅ Use person properties instead
posthog.capture({
  distinctId: userId,
  event: "$set",
  properties: {
    $set: { email: user.email },  // Stored as person property
  },
});
```

### 7. Over-identifying (client-side)

```typescript
// ❌ Calling identify() on every render/page
function MyComponent() {
  useEffect(() => {
    posthog.identify(userId);  // Wrong! Redundant
  }, []);
}

// ❌ Calling identify() before user is authenticated
posthog.identify(undefined);  // Wrong! Creates bad data

// ✅ Let UserContextProvider handle it once per session
// It only calls identify() when userId and email are present
```

### 8. Forgetting reset() on logout

```typescript
// ❌ No reset on logout - events leak to wrong user
function logout() {
  authClient.signOut();
  // Missing: posthog.reset()
}

// ✅ UserContextProvider handles this automatically
// When session clears, it calls posthog.reset()
```

---

## Checklist for New Events

Before adding a new event, verify:

- [ ] **Naming**: follows `noun_verb_past` in snake_case
- [ ] **Location**: server-side if critical, client-side only for UI
- [ ] **distinct_id**: uses `user.id` from database (server-side)
- [ ] **Groups**:
  - Server-side: pass `groups: { organization }` in every call
  - Client-side: rely on `UserContextProvider` session (no need to pass)
- [ ] **Properties**: analytical value only, no redundant IDs
- [ ] **Idempotency**: deduplication for billing/financial events
- [ ] **Funnel fit**: understand which funnel this event belongs to
- [ ] **Not duplicate**: not already tracked elsewhere
