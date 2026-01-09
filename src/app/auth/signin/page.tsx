import { redirect } from 'next/navigation'
import { auth } from "@/lib/auth"
import { headers } from 'next/headers'
import { LoginForm } from '@/components/auth/login-form'
import Image from 'next/image'
import heyhireLogo from '@/assets/heyhire_logo.svg'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  const params = await searchParams
  const callbackUrl = typeof params.callbackUrl === 'string' ? params.callbackUrl : undefined

  // Only redirect if user is authenticated AND not anonymous
  // Anonymous users (from demo iframe) should be able to create a real account
  if (session && !session.user.isAnonymous) {
    return redirect(callbackUrl || "/")
  }
  const errorMessage = typeof params.error === 'string' ? params.error : undefined

  return (
    <div className="flex min-h-svh flex-col p-6 md:p-10">
      <div className="flex justify-center gap-2 md:justify-start">
        <a href="/" className="flex items-center gap-2 font-medium">
          <Image
            src={heyhireLogo}
            alt="Heyhire"
            width={100}
            height={25}
          />
        </a>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-lg">
          <LoginForm initialError={errorMessage} />
        </div>
      </div>
    </div>
  )
}
