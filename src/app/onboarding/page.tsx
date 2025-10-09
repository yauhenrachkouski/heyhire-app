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
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
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
      <div className="relative hidden lg:block overflow-hidden bg-gray-50">
        <div className="flex h-full items-center justify-center p-20">
          <div className="max-w-md space-y-8">
            <blockquote className="space-y-6">
              <p className="text-lg leading-relaxed text-foreground/80">
                "Setting up our workspace took less than a minute. The team was onboarded and sourcing candidates within the same day. Incredible!"
              </p>
              <footer className="space-y-1">
                <div className="font-semibold text-foreground">Sarah K.</div>
                <div className="text-sm text-muted-foreground">Head of Talent</div>
              </footer>
            </blockquote>
            
            <div className="pt-12 border-t border-border/40">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Join thousands of teams using Heyhire to automate their candidate sourcing
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

