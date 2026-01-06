'use client'

import { log } from "@/lib/axiom/client";

const source = "components/account/organization-form";

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icon } from '@/components/icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { updateOrganization } from '@/actions/account'
import { useListOrganizations, useActiveOrganization } from '@/lib/auth-client'

const ORGANIZATION_SIZES = [
  { value: 'just-me', label: 'Just me' },
  { value: '2-10', label: '2-10 people' },
  { value: '11-50', label: '11-50 people' },
  { value: '51-200', label: '51-200 people' },
  { value: '200+', label: '200+ people' },
]

interface OrganizationFormProps {
  organization: {
    id: string
    name: string
    size?: string
  }
}

export function OrganizationForm({ organization }: OrganizationFormProps) {
  const router = useRouter()
  const [organizationName, setOrganizationName] = useState(organization.name)
  const [organizationSize, setOrganizationSize] = useState(organization.size || '')
  const [isLoading, setIsLoading] = useState(false)
  
  // Get refetch functions from better-auth hooks to update client-side cache
  const { refetch: refetchOrganizations } = useListOrganizations()
  const { refetch: refetchActiveOrg } = useActiveOrganization()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!organizationName.trim()) {
      toast.error('Organization name is required')
      return
    }

    setIsLoading(true)
    try {
      const result = await updateOrganization({
        organizationId: organization.id,
        name: organizationName,
        size: organizationSize
      })

      if (result.success) {
        toast.success('Organization updated successfully')
        
        // Refetch organization data to update client-side cache
        // This updates the sidebar and all components using organization hooks
        await Promise.all([
          refetchOrganizations(),
          refetchActiveOrg()
        ])
        
        // Refresh server components to get updated data
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to update organization')
      }
    } catch (err) {
      log.error("Organization update error", { source, error: err })
      toast.error('Failed to update organization')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>
          Manage your organization settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              type="text"
              placeholder="Organization name"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="org-size">Organization Size</Label>
            <Select
              value={organizationSize}
              onValueChange={setOrganizationSize}
              disabled={isLoading}
            >
              <SelectTrigger id="org-size">
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

          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Icon name="loader" className="animate-spin h-4 w-4" />
                Saving...
              </>
            ) : (
              <>
                <Icon name="save" className="h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
