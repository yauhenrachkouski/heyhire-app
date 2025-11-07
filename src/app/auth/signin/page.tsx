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
    <div className="grid min-h-svh lg:grid-cols-[2fr_2fr]">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <LoginForm initialError={errorMessage} />
          </div>
        </div>
      </div>
      <div className="relative hidden lg:flex items-center justify-center overflow-hidden bg-blue-600 p-12">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-left space-y-1">
            <h2 className="text-2xl font-bold text-white">Proactive sourcing made easy</h2>
            <p className="text-lg text-white">Join recruitement teams and individuals winning smart!</p>
          </div>
          
          <div className="bg-white rounded-xl p-10 shadow-2xl">
            <blockquote className="space-y-6">
              <p className="text-lg leading-relaxed text-foreground/90">
                "Heyhire transformed how we source candidates. What used to take weeks now happens in hours. Our hiring pipeline has never been stronger."
              </p>
              <footer className="space-y-1">
                <div className="font-semibold text-foreground">Michael R.</div>
                <div className="text-base text-muted-foreground">VP of Recruitment</div>
              </footer>
            </blockquote>
          </div>
          
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 ">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className={`w-6 h-6 text-yellow-400`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-lg font-semibold text-white">4.9/5</span>
            </div>
            <p className="text-sm text-white/80">Rated by recruiters and agencies worldwide</p>
          </div>
        </div>
      </div>
    </div>
  )
} 