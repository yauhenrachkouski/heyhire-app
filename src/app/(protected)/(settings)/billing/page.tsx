import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { BillingSection } from '@/components/account/billing-section'
import { getUserSubscription } from '@/actions/stripe'
import { redirect } from 'next/navigation'

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

  return (
    <>
      {/* Billing & Subscription */}
      <BillingSection subscription={subscription} />
    </>
  )
}

