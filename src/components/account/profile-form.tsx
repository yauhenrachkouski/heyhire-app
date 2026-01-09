'use client'

import { log } from "@/lib/axiom/client";

const source = "components/account/profile-form";

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Icon } from '@/components/icon'
import { toast } from 'sonner'
import { updateUserProfile, uploadAvatar, removeAvatar } from '@/actions/account'

interface ProfileFormProps {
  user: {
    name: string
    email: string
    image: string | null
    initials: string
  }
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [userName, setUserName] = useState(user.name)
  const lastSavedUserNameRef = useRef(user.name)
  const [userImage, setUserImage] = useState(user.image || '')
  const [isLoading, setIsLoading] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!userName.trim()) {
      toast.error('Name is required')
      return
    }

    setIsLoading(true)
    try {
      const fromName = lastSavedUserNameRef.current
      const result = await updateUserProfile({
        name: userName
      })

      posthog.capture('profile_updated', {
        success: result.success,
        error: result.error,
        from_name: result.success ? fromName : undefined,
        to_name: result.success ? userName : undefined,
      })

      if (result.success) {
        lastSavedUserNameRef.current = userName
        toast.success('Profile updated successfully')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to update profile')
      }
    } catch (err) {
      log.error("profile.update_error", { source, error: err instanceof Error ? err.message : String(err) })
      toast.error('Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB')
      return
    }

    setIsUploadingAvatar(true)
    try {
      const fromHasAvatar = !!userImage

      const formData = new FormData()
      formData.append('file', file)

      const result = await uploadAvatar(formData)

      posthog.capture('avatar_uploaded', {
        success: result.success,
        file_size: file.size,
        file_type: file.type,
        error: result.error,
        from_has_avatar: result.success ? fromHasAvatar : undefined,
        to_has_avatar: result.success ? true : undefined,
      })

      if (result.success && result.imageUrl) {
        setUserImage(result.imageUrl)
        toast.success('Avatar uploaded successfully')
        // Invalidate session to update sidebar avatar via TanStack Query
        await queryClient.invalidateQueries({ queryKey: ['session'] })
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to upload avatar')
      }
    } catch (err) {
      log.error("avatar.upload_error", { source, error: err instanceof Error ? err.message : String(err) })
      toast.error('Failed to upload avatar')
    } finally {
      setIsUploadingAvatar(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveAvatar = async () => {
    setIsUploadingAvatar(true)
    try {
      const fromHasAvatar = !!userImage
      const result = await removeAvatar()

      posthog.capture('avatar_removed', {
        success: result.success,
        error: result.error,
        from_has_avatar: result.success ? fromHasAvatar : undefined,
        to_has_avatar: result.success ? false : undefined,
      })

      if (result.success) {
        setUserImage('')
        toast.success('Avatar removed successfully')
        // Invalidate session to update sidebar avatar via TanStack Query
        await queryClient.invalidateQueries({ queryKey: ['session'] })
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to remove avatar')
      }
    } catch (err) {
      log.error("avatar.removal_error", { source, error: err instanceof Error ? err.message : String(err) })
      toast.error('Failed to remove avatar')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  return (
    <section>
      <div className="space-y-1 mb-4">
        <h3 className="text-base font-semibold">Profile</h3>
        <p className="text-sm text-muted-foreground">
          Update your personal information
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 shrink-0">
              {userImage && <AvatarImage src={userImage} alt={userName} />}
              <AvatarFallback className="text-xl sm:text-2xl">{user.initials}</AvatarFallback>
            </Avatar>
            <div className="w-full sm:flex-1 space-y-2">
              <Label>Profile Picture</Label>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  disabled={isUploadingAvatar || isLoading}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar || isLoading}
                >
                  {isUploadingAvatar ? (
                    <>
                      <Icon name="loader" className="animate-spin h-4 w-4" />
                      <span className="hidden sm:inline">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="upload" className="h-4 w-4" />
                      <span className="hidden sm:inline">Upload Avatar</span>
                      <span className="sm:hidden">Upload</span>
                    </>
                  )}
                </Button>
                {userImage && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={isUploadingAvatar || isLoading}
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a profile picture (max 5MB)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="bg-muted cursor-not-allowed"
            />
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
    </section>
  )
}
