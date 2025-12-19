import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { BillingSection } from '@/components/account/billing-section'
import { PaymentMethodBlock } from '@/components/account/payment-method-block'
import { InvoicesCard } from '@/components/account/invoices-card'
import { CancellationSection } from '@/components/account/cancellation-section'
import { getUserSubscription } from '@/actions/stripe'
import { redirect } from 'next/navigation'
import { Icon } from '@/components/ui/icon'

export default async function BillingPage() {
  // Fetch session data on the server
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Fetch subscription
  const { subscription } = await getUserSubscription()

  const isTrialing = subscription?.status === 'trialing'
  const trialEndLabel = subscription?.trialEnd
    ? new Date(subscription.trialEnd).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null
  const nextBillingLabel = (subscription?.periodEnd ?? subscription?.trialEnd)
    ? new Date((subscription?.periodEnd ?? subscription?.trialEnd) as any).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  const nextBillingAmountLabel = subscription?.plan === 'pro' ? '$69' : null

  return (
    <>
      {/* Billing & Subscription */}
      {isTrialing && (
        <div className="rounded-lg border p-4 sm:p-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-base font-semibold">
              <Icon name="sparkles" className="h-4 w-4 text-muted-foreground" />
              <span>Trial</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {trialEndLabel ? (
                <>
                  Your trial ends on {trialEndLabel}.{' '}
                  {nextBillingLabel
                    ? `Next billing will charge you${nextBillingAmountLabel ? ` ${nextBillingAmountLabel}` : ''} on ${nextBillingLabel}.`
                    : `Next billing will charge you${nextBillingAmountLabel ? ` ${nextBillingAmountLabel}` : ''} when your trial ends.`}
                </>
              ) : (
                <>
                  Your trial is active.{' '}
                  {nextBillingLabel
                    ? `Next billing will charge you${nextBillingAmountLabel ? ` ${nextBillingAmountLabel}` : ''} on ${nextBillingLabel}.`
                    : `Next billing will charge you${nextBillingAmountLabel ? ` ${nextBillingAmountLabel}` : ''} when your trial ends.`}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <BillingSection subscription={subscription} />
      <PaymentMethodBlock />
      <InvoicesCard subscription={subscription} />
      {subscription && <CancellationSection subscription={subscription} />}
    </>
  )
}

