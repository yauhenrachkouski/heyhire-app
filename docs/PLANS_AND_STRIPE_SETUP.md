# Plans and Stripe setup

## Plans

- **pro**
  - Price: **$69/month**
  - Trial: **3 days**

Plan config lives in `src/lib/auth.ts` (better-auth Stripe plugin).

## Stripe objects you must create

Stripe **test mode** and **live mode** are separate. You need to create:

- Product: `pro`
- Price (recurring):
  - Pro monthly $69

Your app uses **Price IDs** (not Product IDs).

## Environment variables

Set these per environment:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`

### Dev / local (Stripe test mode)

Use **test** keys (`sk_test_...`) and **test** price IDs.

Example (created in test mode):

- `STRIPE_PRO_PRICE_ID=price_1SfkCeGmWFGiZ2jHB5BQoStT`

### Production (Stripe live mode)

Use **live** keys (`sk_live_...`) and create **live** products/prices.

## Create products/prices with Stripe CLI

Your Stripe CLI version uses:

- `--unit-amount` (not `--unit_amount`)
- `--recurring.interval=month`

### Test mode (default)

Create products:

```bash
stripe products create --name="pro"
```

Create prices:

```bash
stripe prices create \
  --product=PROD_PRO_TEST \
  --currency=usd \
  --unit-amount=6900 \
  --recurring.interval=month \
  --nickname="pro_monthly_69"
```

### Live mode

Same commands, but add `--live`:

```bash
stripe products create --live --name="pro"
```

```bash
stripe prices create \
  --live \
  --product=PROD_PRO_LIVE \
  --currency=usd \
  --unit-amount=6900 \
  --recurring.interval=month \
  --nickname="pro_monthly_69"
```

Copy the resulting `price_...` IDs into production env vars.

## Notes / best practice

- When changing pricing later, **create a new Price** in Stripe (don’t edit the old one), then update env vars.
- Keep test and live IDs separate.
