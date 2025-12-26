'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icon } from '@/components/custom/icon'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import googleIcon from '@/assets/google-icon.svg'
import heyhireLogo from '@/assets/heyhire_logo.svg'

function getCallbackUrlFromLocation(): string {
  if (typeof window === 'undefined') {
    return '/auth/callback'
  }
  const url = new URL(window.location.href)
  const callbackUrl = url.searchParams.get('callbackUrl')
  return callbackUrl || '/auth/callback'
}

async function signInWithGoogle(callbackURL: string) {
  try {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL,
    })
  } catch (err) {
    console.error('Google sign in error:', err)
  }
}

export function LoginForm({ initialError }: { initialError?: string }) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState(initialError || '')
  const [lastMethod, setLastMethod] = useState<string | null>(null)
  const [callbackURL, setCallbackURL] = useState('/auth/callback')
  const isInviteCallback = callbackURL.startsWith('/auth/accept-invitation/')

  useEffect(() => {
    if (initialError) {
      setError(initialError)
    }
    // Get the last used login method
    const method = authClient.getLastUsedLoginMethod()
    setLastMethod(method)
    setCallbackURL(getCallbackUrlFromLocation())
  }, [initialError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email) {
      setError('Please enter your email')
      return
    }

    setIsLoading(true)

    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL,
      })
      
      // Check if there's an error in the result
      if (result.error) {
        const errorMessage = result.error.message || 'Failed to send magic link'
        setError(errorMessage)
        return
      }
      
      setEmailSent(true)
      toast.success('Check your email for a magic link to sign in!')
    } catch (err: any) {
      const errorMessage = err?.message || err?.body?.message || 'Failed to send magic link. Please try again.'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <Card className="w-full shadow-none ring-0">
        <CardHeader className="text-left">
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="text-sm font-medium">Magic link sent</div>
              <div className="mt-1 text-sm text-muted-foreground">
                We've sent a magic link to <b className="font-medium text-foreground">{email}</b>. Click the link in the email to sign in.
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Didn't receive the email? Check your spam folder or{' '}
              <button
                onClick={() => setEmailSent(false)}
                className="underline hover:text-foreground"
              >
                try again
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full shadow-none ring-0">
      <CardHeader className="text-left space-y-6">
        <div className="space-y-2">
          <CardTitle className="text-2xl font-bold">Welcome to HeyHire</CardTitle>
          <CardDescription className="text-muted-foreground text-base">Start your journey to finding the perfect candidates</CardDescription>   
        </div>

        {isInviteCallback && (
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="text-sm font-medium">You’ve been invited to join an organization</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Sign up to accept your invitation.
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <Button 
            type="button" 
            variant={lastMethod === 'google' ? 'default' : 'outline'}
            className={lastMethod === 'google' ? 'w-full' : 'w-full bg-black text-white hover:bg-black/80 hover:text-white'}
            size="lg"
            onClick={() => signInWithGoogle(callbackURL)}
          >
            <Image 
              src={googleIcon} 
              alt="Google" 
              width={18} 
              height={18}
              className=""
            />
            Continue with Google
            {lastMethod === 'google' && (
              <Badge variant="secondary" className="ml-2">Last used</Badge>
            )}
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
          
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              variant={lastMethod === 'magicLink' ? 'default' : 'default'}
            >
              {isLoading ? (
                <>
                  <Icon name="loader" size={16} className="animate-spin" />
                  Sending magic link...
                </>
              ) : (
                <>
                  <Icon name="mail" size={16} />
                  Continue with Email
                  {lastMethod === 'magicLink' && (
                    <Badge variant="secondary" className="ml-2">Last used</Badge>
                  )}
                </>
              )}
            </Button>
          
            
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
