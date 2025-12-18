import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

export default async function AuthCallbackPage() {
  const requestHeaders = await headers()

  const session = await auth.api.getSession({
    headers: requestHeaders
  })

  // No session, redirect to sign in
  if (!session) {
    return redirect('/auth/signin')
  }

  // Get user's organizations
  const organizations = await auth.api.listOrganizations({
    headers: requestHeaders
  })

  // Check if user has any organizations
  if (organizations && organizations.length > 0) {
    // Set the first organization as active
    await auth.api.setActiveOrganization({
      headers: requestHeaders,
      body: { organizationId: organizations[0].id }
    })

    revalidatePath('/(protected)', 'layout')
    revalidatePath('/paywall')
    
    // User has organizations, go to dashboard
    return redirect('/')
  } else {
    // No organizations, go to onboarding
    return redirect('/onboarding')
  }
}


