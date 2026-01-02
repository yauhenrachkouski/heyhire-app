import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { BillingSection } from '@/components/account/billing-section'
import { PaymentMethodBlock } from '@/components/account/payment-method-block'
import { InvoicesCard } from '@/components/account/invoices-card'
import { CancellationSection } from '@/components/account/cancellation-section'
import { getUserSubscription } from '@/actions/stripe'
import { redirect } from 'next/navigation'
import { Icon } from '@/components/icon'
import { Button } from '@/components/ui/button'
import { TrialBanner } from '@/components/account/trial-banner'
import { getOrganizationMembership } from '@/actions/account'
import { ADMIN_ROLES } from '@/lib/roles'
import { getCreditsUsageForPeriod, getOrganizationCredits } from '@/actions/credits'

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
  const activeOrgId = session.session?.activeOrganizationId ?? null

  const membershipResult = activeOrgId
    ? await getOrganizationMembership(activeOrgId)
    : ({ success: false, error: 'No active organization' } as const)

  let userRole: string | null = null
  if (membershipResult.success && membershipResult.data) {
    userRole = membershipResult.data.role?.toLowerCase() ?? null
  }

  const canManageBilling = userRole ? ADMIN_ROLES.has(userRole) : false

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

  // Fetch initial period usage for SSR
  let initialPeriodUsed: number | undefined = undefined;
  let organizationCredits: number | undefined = undefined;
  if (activeOrgId && subscription?.periodStart && subscription?.periodEnd) {
    const result = await getCreditsUsageForPeriod({
      organizationId: activeOrgId,
      startDate: new Date(subscription.periodStart),
      endDate: new Date(subscription.periodEnd),
    });
    if (!result.error) {
      initialPeriodUsed = result.used;
    }
  }
  if (activeOrgId) {
    organizationCredits = await getOrganizationCredits(activeOrgId);
  }

  return (
    <>
      {/* Billing & Subscription */}
      {isTrialing && (
        <TrialBanner
          trialEndLabel={trialEndLabel}
          nextBillingLabel={nextBillingLabel}
          nextBillingAmountLabel={nextBillingAmountLabel}
        />
      )}

      <BillingSection 
        subscription={subscription} 
        initialPeriodUsed={initialPeriodUsed}
        currentBalance={organizationCredits}
      />
      {canManageBilling && <PaymentMethodBlock />}
      <InvoicesCard subscription={subscription} />
      {subscription && canManageBilling && <CancellationSection subscription={subscription} />}
    </>
  )
}
