'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icon } from '@/components/ui/icon'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSession } from '@/lib/auth-client'
import { toast } from 'sonner'
import { createDefaultOrganization, createOrganizationWithSetup } from '@/actions/account'

const ORGANIZATION_SIZES = [
  { value: 'just-me', label: 'Just me' },
  { value: '2-10', label: '2-10 people' },
  { value: '11-50', label: '11-50 people' },
  { value: '51-200', label: '51-200 people' },
  { value: '200+', label: '200+ people' },
]

export function OnboardingForm() {
  const router = useRouter()
  const { data: session } = useSession()
  
  const [userName, setUserName] = useState(session?.user?.name || '')
  const [organizationName, setOrganizationName] = useState('')
  const [organizationSize, setOrganizationSize] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!userName) {
      setError('Please enter your name')
      return
    }

    setIsLoading(true)

    try {
      const orgName = organizationName.trim() || 'Default Workspace'
      
      console.log('[OnboardingForm] Submitting organization creation:', { orgName, size: organizationSize })
      
      // Use server-side organization creation
      const result = await createOrganizationWithSetup({
        name: orgName,
        size: organizationSize,
      })

      console.log('[OnboardingForm] Organization creation result:', result)

      if (!result.success) {
        throw new Error(result.error || 'Failed to create organization')
      }

      toast.success('Onboarding completed successfully!')
      console.log('[OnboardingForm] Redirecting to /subscribe')
      await new Promise(resolve => setTimeout(resolve, 500))
      router.push('/subscribe')
    } catch (err: any) {
      console.error('[OnboardingForm] Organization creation error:', err)
      setError(err?.message || 'Failed to create organization')
      toast.error('Failed to create organization. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = async () => {
    setIsLoading(true)
    try {
      console.log('[OnboardingForm] Skipping - creating default organization')
      const result = await createDefaultOrganization()
      
      console.log('[OnboardingForm] Default organization result:', result)
      
      if (result.error) {
        throw new Error(result.error)
      }

      toast.success('Default workspace created!')
      console.log('[OnboardingForm] Redirecting to /subscribe')
      router.push('/subscribe')
    } catch (err: any) {
      console.error('[OnboardingForm] Failed to create default organization:', err)
      toast.error('Failed to create workspace. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full shadow-none border-none">
      <CardHeader className="text-left">
        <CardTitle className="text-2xl font-bold">Welcome to Heyhire! 👋</CardTitle>
        <p className="text-gray-600">Let's set up your workspace to get started</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="userName">Your Name</Label>
            <Input
              id="userName"
              name="userName"
              type="text"
              placeholder="John Doe"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationName">
              Organization Name <span className="text-muted-foreground text-sm">(optional)</span>
            </Label>
            <Input
              id="organizationName"
              name="organizationName"
              type="text"
              placeholder="Default Workspace"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              disabled={isLoading}
            />
           
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationSize">
              Organization Size <span className="text-muted-foreground text-sm">(optional)</span>
            </Label>
            <Select
              value={organizationSize}
              onValueChange={setOrganizationSize}
              disabled={isLoading}
            >
              <SelectTrigger id="organizationSize" className="w-full">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {ORGANIZATION_SIZES.map((size) => (
                  <SelectItem key={size.value} value={size.value}>
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Icon name="loader" size={16} className="animate-spin" />
                Creating workspace...
              </>
            ) : (
              <>
                <Icon name="check" size={16} />
                Finish Onboarding
              </>
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleSkip}
              disabled={isLoading}
              className="text-sm text-muted-foreground hover:text-foreground underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Skip for now
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

