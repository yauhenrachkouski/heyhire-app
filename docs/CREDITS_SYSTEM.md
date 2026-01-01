# Credits System Documentation

## Overview

The credits system allows organizations to track and manage their usage of premium features like contact lookups and exports. It provides a flexible, extensible architecture with full audit trails for all credit transactions.

## Architecture

### Database Schema

#### Organization Table
- **credits** (integer, default: 0): Current total credit balance for the organization

#### Credit Transactions Table
Stores complete audit trail of all credit operations:
- **id** (text): Unique transaction identifier
- **organizationId** (text): Organization that owns the transaction
- **userId** (text): User who performed the action
- **type** (enum): Type of transaction
  - `subscription_grant`: Credits granted from subscription
  - `manual_grant`: Credits manually added by admin
  - `purchase`: Credits purchased separately
  - `consumption`: Credits used for an action
- **creditType** (enum): What the credits are for
  - `contact_lookup`: Contact enrichment (email/phone reveal)
  - `export`: Data exports
  - `general`: General purpose credits
- **amount** (integer): Credit amount (positive for additions, negative for consumption)
- **balanceBefore** (integer): Snapshot of balance before transaction
- **balanceAfter** (integer): Snapshot of balance after transaction
- **relatedEntityId** (text, nullable): ID of related entity (subscription_id, candidate_id, etc.)
- **description** (text): Human-readable description
- **metadata** (text, nullable): JSON for additional data
- **createdAt** (timestamp): When the transaction occurred

## Credit Types

### Contact Lookup Credits
**Cost:** 1 credit per lookup  
**Usage:** Revealing contact information (email/phone) for candidates  
**Plan Allocations:**

- Pro: 1000 credits/month


### General Credits
**Purpose:** Flexible credits for future features  
**Current Usage:** None (reserved for future use)

## How Credits Work

### 1. Credit Granting

#### Subscription-Based Granting
When a subscription payment succeeds (via Stripe webhook):
1. System determines plan level ("pro")
2. Looks up credit allocations for that plan
3. Grants credits for each credit type
4. Creates transaction records with type `subscription_grant`

**Location:** `src/lib/auth.ts` - `invoice.payment_succeeded` webhook handler

#### Manual Granting
Admins can manually grant credits using:
```typescript
await addCredits({
  organizationId: "org_123",
  userId: "user_456",
  amount: 50,
  type: "manual_grant",
  creditType: "contact_lookup",
  description: "Bonus credits for feedback",
});
```

### 2. Credit Consumption

When a feature uses credits:
```typescript
// Check if organization can afford the action
const canAfford = await canAfford(organizationId, 1, "contact_lookup");

if (!canAfford) {
  throw new Error("Insufficient credits");
}

// Deduct credits
await deductCredits({
  organizationId,
  userId,
  amount: 1,
  creditType: "contact_lookup",
  relatedEntityId: candidateId,
  description: "Contact lookup for John Doe",
  metadata: { candidateName: "John Doe" },
});
```

### 3. Credit Balance Display

Credit balance is displayed in the sidebar footer:
- Shows current total balance
- Warns when balance is low (<10 credits)
- Shows infinity symbol (∞) for unlimited credits
- Links to billing page for top-up

**Location:** `src/components/sidebar/credit-balance.tsx`

## API Reference

### Server Actions (`src/actions/credits.ts`)

#### `getOrganizationCredits(organizationId: string): Promise<number>`
Get current total credit balance for an organization.

#### `getCreditBalance(organizationId: string, creditType?: CreditType): Promise<number>`
Get total balance or balance for specific credit type.

#### `canAfford(organizationId: string, amount: number, creditType?: CreditType): Promise<boolean>`
Check if organization has sufficient credits.

#### `addCredits(params: AddCreditsParams): Promise<CreditOperationResult>`
Add credits to an organization. Creates transaction record with full audit trail.

**Parameters:**
```typescript
{
  organizationId: string;
  userId: string;
  amount: number; // Must be positive
  type: TransactionType;
  creditType: CreditType;
  relatedEntityId?: string;
  description: string;
  metadata?: Record<string, any>;
}
```

#### `deductCredits(params: DeductCreditsParams): Promise<CreditOperationResult>`
Deduct credits from an organization. Throws error if insufficient balance.

**Parameters:**
```typescript
{
  organizationId: string;
  userId: string;
  amount: number; // Must be positive (will be stored as negative)
  creditType: CreditType;
  relatedEntityId: string;
  description: string;
  metadata?: Record<string, any>;
}
```

#### `getCreditHistory(organizationId: string, filters?: CreditHistoryFilters): Promise<CreditTransaction[]>`
Get transaction history with optional filters.

**Filters:**
```typescript
{
  creditType?: CreditType;
  transactionType?: TransactionType;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  limit?: number; // Default: 50
  offset?: number; // Default: 0
}
```

#### `getCreditStats(organizationId: string): Promise<CreditStats>`
Get usage statistics including totals by type and recent transactions.

### Utility Functions (`src/lib/credits.ts`)

#### `formatCreditAmount(amount: number): string`
Format credit amount for display with +/- sign.

#### `getCreditTypeLabel(creditType: CreditType): string`
Get human-readable label for credit type.

#### `getTransactionTypeLabel(type: TransactionType): string`
Get human-readable label for transaction type.

#### `calculateCreditCost(action: "contact_lookup" | "export", params?: { count?: number }): number`
Calculate cost for an action (with optional count multiplier).

#### `getPlanCreditAllocation(plan: string, creditType: CreditType): number`
Get credit allocation for a specific plan and type. Returns -1 for unlimited.

#### `formatCreditBalance(balance: number): string`
Format balance for display (shows ∞ for unlimited).

#### `isLowOnCredits(balance: number, threshold?: number): boolean`
Check if balance is below warning threshold (default: 10).

## Adding New Credit Types

To add a new credit type (e.g., "api_calls"):

### 1. Update Database Schema
```typescript
// src/db/schema.ts
export const creditTypeEnum = pgEnum('credit_type', [
  'contact_lookup', 
  'export', 
  'general',
  'api_calls' // Add new type
]);
```

### 2. Generate Migration
```bash
bunx drizzle-kit generate
bunx drizzle-kit push
```

### 3. Update TypeScript Types
```typescript
// src/types/credits.ts
export type CreditType = "contact_lookup" | "export" | "general" | "api_calls";
```

### 4. Update Utility Functions
```typescript
// src/lib/credits.ts
export function getCreditTypeLabel(creditType: CreditType): string {
  const labels: Record<CreditType, string> = {
    contact_lookup: "Contact Lookup",
    export: "Export",
    general: "General",
    api_calls: "API Calls", // Add label
  };
  return labels[creditType];
}

// Update plan allocations
export const PLAN_CREDIT_ALLOCATIONS = {
  starter: {
    contact_lookup: 100,
    export: 50,
    api_calls: 1000, // Add allocation
  },
  // ... other plans
};
```

### 5. Implement Consumption
Wrap your feature with credit checking and deduction:
```typescript
async function makeApiCall(organizationId: string, userId: string) {
  // Check credits
  const hasCredits = await canAfford(organizationId, 1, "api_calls");
  if (!hasCredits) {
    throw new Error("Insufficient API call credits");
  }
  
  // Perform action
  const result = await yourApiCall();
  
  // Deduct credits
  await deductCredits({
    organizationId,
    userId,
    amount: 1,
    creditType: "api_calls",
    relatedEntityId: result.id,
    description: "API call to external service",
  });
  
  return result;
}
```

## Best Practices

### 1. Always Use Transactions
Credit operations use database transactions to ensure atomicity. Never bypass the provided functions.

### 2. Provide Descriptive Information
- Use clear descriptions for transactions
- Include relevant metadata for debugging
- Link related entities via `relatedEntityId`

### 3. Check Before Consuming
Always check credit availability before performing expensive operations:
```typescript
if (!(await canAfford(orgId, cost, creditType))) {
  // Show user error, redirect to billing, etc.
  return;
}
```

### 4. Handle Errors Gracefully
Credit deduction can fail. Always handle errors:
```typescript
const result = await deductCredits({ ... });
if (!result.success) {
  console.error("Failed to deduct credits:", result.error);
  // Rollback your operation if needed
}
```

### 5. Audit Trail
The full audit trail is maintained automatically. Use it for:
- Debugging credit issues
- Generating usage reports
- Compliance and billing records

## Monitoring & Debugging

### Check Current Balance
```typescript
const balance = await getOrganizationCredits(organizationId);
console.log(`Current balance: ${balance}`);
```

### View Recent Transactions
```typescript
const history = await getCreditHistory(organizationId, { limit: 20 });
history.forEach(tx => {
  console.log(`${tx.createdAt}: ${tx.description} (${tx.amount})`);
});
```

### View Usage Statistics
```typescript
const stats = await getCreditStats(organizationId);
console.log(`Total used: ${stats.totalUsed}`);
console.log(`Contact lookups used: ${stats.byType.contact_lookup.used}`);
```

## Future Enhancements

Potential improvements to consider:

1. **Credit Packages**: Allow one-time credit purchases
2. **Credit Expiration**: Set expiration dates on credits
3. **Credit Pooling**: Share credits across multiple organizations
4. **Usage Alerts**: Email notifications for low balance
5. **Credit Rollover**: Carry unused credits to next period
6. **Tiered Pricing**: Different costs based on usage volume
7. **Refunds**: System for refunding consumed credits
8. **Credit Transfer**: Move credits between organizations

## Support

For questions or issues with the credits system:
1. Check transaction history for audit trail
2. Review error logs in credit actions
3. Verify database transactions were completed
4. Contact development team for assistance








