'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icon } from '@/components/ui/icon'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { authClient } from '@/lib/auth-client'
import { toast } from 'sonner'
import googleIcon from '@/assets/google-icon.svg'

async function signInWithGoogle() {
  try {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/auth-callback',
    })
  } catch (err) {
    console.error('Google sign in error:', err)
  }
}

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!email) {
      setError('Please enter your email')
      return
    }

    setIsLoading(true)

    try {
      await authClient.signIn.magicLink({
        email,
        callbackURL: '/auth-callback',
      })
      
      setEmailSent(true)
      toast.success('Check your email for a magic link to sign in!')
    } catch (err: any) {
      setError(err?.message || 'Failed to send magic link')
      toast.error('Failed to send magic link. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (emailSent) {
    return (
      <Card className="w-full shadow-none border-none">
        <CardHeader className="text-left">
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <Icon name="mail" className="h-4 w-4" />
              <AlertDescription>
                We've sent a magic link to <strong>{email}</strong>. Click the link in the email to sign in.
              </AlertDescription>
            </Alert>
            
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
    <Card className="w-full shadow-none border-none">
      <CardHeader className="text-left">
        <CardTitle className="text-2xl font-bold">Welcome to HeyHire</CardTitle>
        <p className="text-gray-600">Enter your email to continue</p>
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
            variant="outline" 
            className="w-full bg-black text-white hover:bg-black/80 hover:text-white"
            size="lg"
            onClick={signInWithGoogle}
          >
            <Image 
              src={googleIcon} 
              alt="Google" 
              width={18} 
              height={18}
              className=""
            />
            Continue with Google
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
                </>
              )}
            </Button>
          
            
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
