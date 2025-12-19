import { auth } from "@/lib/auth"
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { headers } from 'next/headers'
import { OnboardingForm } from '@/components/auth/onboarding-form'
import heyhireLogo from '@/assets/heyhire_logo.svg'

const fetchCompanySuggestions = async (domain: string): Promise<string | null> => {
  try {
    const response = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${domain}`)
    const data: Array<{ name: string; domain: string; logo: string | null }> = await response.json()
    
    // Sort to prioritize lawyers
    const sorted = data.sort((a, b) => {
      const aIsLawyer = a.name.toLowerCase().includes('lawyer') || a.name.toLowerCase().includes('law')
      const bIsLawyer = b.name.toLowerCase().includes('lawyer') || b.name.toLowerCase().includes('law')
      if (aIsLawyer && !bIsLawyer) return -1
      if (!aIsLawyer && bIsLawyer) return 1
      return 0
    })
    
    return sorted[0]?.name || null
  } catch (e) {
    console.error('Failed to fetch company suggestions:', e)
    return null
  }
}

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session) {
    return redirect("/auth/signin")
  }

  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  })

  if (organizations && organizations.length > 0) {
    return redirect('/paywall')
  }

  // Fetch initial organization name suggestion
  let initialOrganizationName = ''
  let initialLogo = ''
  if (session.user?.email) {
    const emailDomain = session.user.email.split('@')[1]
    if (emailDomain) {
      initialLogo = `https://www.google.com/s2/favicons?domain=${emailDomain}&sz=32`
      const suggestion = await fetchCompanySuggestions(emailDomain)
      if (suggestion) {
        initialOrganizationName = suggestion
      } else {
        // Fallback to capitalized domain name
        initialOrganizationName = emailDomain.split('.')[0].replace(/^\w/, c => c.toUpperCase())
      }
    }
  }
  
  return (
    <div className="flex min-h-svh flex-col p-6 md:p-10">
      <div className="flex justify-center gap-2 md:justify-start">
        <a href="/" className="flex items-center gap-2 font-medium">
          <Image
            src={heyhireLogo}
            alt="HeyHire"
            width={100}
            height={25}
          />
        </a>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-lg">
          <OnboardingForm initialOrganizationName={initialOrganizationName} initialLogo={initialLogo} />
        </div>
      </div>
    </div>
  )
}

