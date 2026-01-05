'use client'

import { log } from "@/lib/axiom/client-log";

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icon } from '@/components/icon'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import Image from 'next/image'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSession } from '@/lib/auth-client'
import { toast } from 'sonner'
import { createOrganizationWithSetup } from '@/actions/account'
import { addDemoWorkspaceForCurrentUser } from '@/actions/demo'

const ORGANIZATION_SIZES = [
  { value: 'just-me', label: 'Just me' },
  { value: '2-10', label: '2-10 people' },
  { value: '11-50', label: '11-50 people' },
  { value: '51-200', label: '51-200 people' },
  { value: '200+', label: '200+ people' },
]

export function OnboardingForm({ 
  initialOrganizationName, 
  initialLogo, 
  googleLink,
  initialUserName = ''
}: { 
  initialOrganizationName: string; 
  initialLogo?: string; 
  googleLink?: string;
  initialUserName?: string;
}) {
  const router = useRouter()
  const { data: session } = useSession()
  
  const [userName, setUserName] = useState(initialUserName)
  const [organizationName, setOrganizationName] = useState(initialOrganizationName || '')
  const [organizationSize, setOrganizationSize] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [includeDemoWorkspace, setIncludeDemoWorkspace] = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!userName.trim()) {
      setError('Please enter your name')
      return
    }

    setIsLoading(true)

    try {
      const orgName = organizationName.trim() || 'Default Organization'
      
      log.info("OnboardingForm", "Submitting organization creation", {
        orgName,
        size: organizationSize,
        logo: initialLogo,
      })
      
      // Use server-side organization creation
      const result = await createOrganizationWithSetup({
        name: orgName,
        size: organizationSize,
        logo: initialLogo,
        googleLink: googleLink,
      })

      log.info("OnboardingForm", "Organization creation result", { result })

      if (!result.success) {
        throw new Error(result.error || 'Failed to create organization')
      }

      if (includeDemoWorkspace) {
        try {
          await addDemoWorkspaceForCurrentUser()
        } catch (demoError) {
          log.warn("OnboardingForm", "Failed to add demo workspace", { error: demoError })
        }
      }

      toast.success('Onboarding completed successfully!')
      log.info("OnboardingForm", "Redirecting to /subscribe")
      await new Promise(resolve => setTimeout(resolve, 500))
      router.refresh()
      router.push('/paywall')
    } catch (err: any) {
      log.error("OnboardingForm", "Organization creation error", { error: err })
      setError(err?.message || 'Failed to create organization')
      toast.error('Failed to create organization. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = async () => {
    setIsLoading(true)
    try {
      log.info("OnboardingForm", "Creating organization with predefined name", {
        organizationName: initialOrganizationName,
      })
      const result = await createOrganizationWithSetup({
        name: initialOrganizationName,
      })
      
      log.info("OnboardingForm", "Organization creation result", { result })
      
      if (result.error) {
        throw new Error(result.error)
      }

      if (includeDemoWorkspace) {
        try {
          await addDemoWorkspaceForCurrentUser()
        } catch (demoError) {
          log.warn("OnboardingForm", "Failed to add demo workspace", { error: demoError })
        }
      }

      toast.success('Organization created!')
      log.info("OnboardingForm", "Redirecting to /paywall")
      router.refresh()
      router.push('/paywall')
    } catch (err: any) {
      log.error("OnboardingForm", "Failed to create organization", { error: err })
      toast.error('Failed to create organization. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full shadow-none ring-0">
      <CardHeader className="text-left">
        <CardTitle className="text-2xl font-bold">Welcome to Heyhire! 👋</CardTitle>
        <CardDescription className="text-muted-foreground text-base">Let's set up your organization to get started</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!initialUserName && (
            <div className="space-y-2">
              <Label htmlFor="userName">Full Name</Label>
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
          )}

          <div className="space-y-2">
            <Label htmlFor="organizationName">
              Organization Name <span className="text-muted-foreground text-sm">(optional)</span>
            </Label>
            <div className="relative">
              <Input
                id="organizationName"
                name="organizationName"
                type="text"
                placeholder="Default Organization"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                disabled={isLoading}
                className="pl-8"
              />
              {initialLogo && (
                <Image
                  src={initialLogo}
                  alt="Organization logo"
                  width={20}
                  height={20}
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 rounded"
                />
              )}
            </div>
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

          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="includeDemoWorkspace"
              checked={includeDemoWorkspace}
              onCheckedChange={(checked) => setIncludeDemoWorkspace(checked === true)}
              disabled={isLoading}
            />
            <Label htmlFor="includeDemoWorkspace" className="text-sm font-normal text-muted-foreground">
              Add a demo workspace with sample data
            </Label>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Icon name="loader" size={16} className="animate-spin" />
                Creating organization...
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
