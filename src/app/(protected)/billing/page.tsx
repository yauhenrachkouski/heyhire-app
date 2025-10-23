import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { Separator } from '@/components/ui/separator'
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and billing
        </p>
      </div>

      <Separator />

      {/* Billing & Subscription */}
      <BillingSection subscription={subscription} />
    </div>
  )
}

