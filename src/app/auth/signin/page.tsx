import { redirect } from 'next/navigation'
import { auth } from "@/lib/auth"
import { headers } from 'next/headers'
import { LoginForm } from '@/components/auth/login-form'


export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await auth.api.getSession({
    headers: await headers()
 })

 if (session) {
    return redirect("/")
 }

  const params = await searchParams
  const errorMessage = typeof params.error === 'string' ? params.error : undefined

  return (
    <div className="flex min-h-svh items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <LoginForm initialError={errorMessage} />
      </div>
    </div>
  )
} 