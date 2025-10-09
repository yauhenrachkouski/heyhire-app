import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export default async function AuthCallbackPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  // No session, redirect to sign in
  if (!session) {
    return redirect('/auth/signin')
  }

  // Get user's organizations
  const organizations = await auth.api.listOrganizations({
    headers: await headers()
  })

  // Check if user has any organizations
  if (organizations && organizations.length > 0) {
    // User has organizations, go to dashboard
    return redirect('/')
  } else {
    // No organizations, go to onboarding
    return redirect('/onboarding')
  }
}

