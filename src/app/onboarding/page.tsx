import { auth } from "@/lib/auth"
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { headers } from 'next/headers'
import { OnboardingForm } from '@/components/auth/onboarding-form'

export default async function OnboardingPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session) {
    return redirect("/auth/signin")
  }
  
  return (
    <div className="flex min-h-svh flex-col p-6 md:p-10">
      <div className="flex justify-center gap-2 md:justify-start">
        <a href="/" className="flex items-center gap-2 font-medium">
          <Image
            src="/heyhire_logo.svg"
            alt="HeyHire"
            width={100}
            height={25}
          />
        </a>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-lg">
          <OnboardingForm />
        </div>
      </div>
    </div>
  )
}

