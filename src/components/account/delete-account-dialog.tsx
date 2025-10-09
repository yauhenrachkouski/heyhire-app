'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Icon } from '@/components/ui/icon'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { softDeleteAccount } from '@/actions/account'

interface DeleteAccountDialogProps {
  userEmail: string
}

export function DeleteAccountDialog({ userEmail }: DeleteAccountDialogProps) {
  const router = useRouter()
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== userEmail) {
      toast.error('Email does not match')
      return
    }

    setIsDeleting(true)
    try {
      const result = await softDeleteAccount()

      if (result.success) {
        toast.success('Account deleted successfully')
        router.push('/auth/signin')
      } else {
        toast.error(result.error || 'Failed to delete account')
      }
    } catch (err) {
      console.error('Delete account error:', err)
      toast.error('Failed to delete account')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="text-destructive">Danger Zone</CardTitle>
        <CardDescription>
          Irreversible actions for your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Alert variant="destructive">
            <Icon name="alert-triangle" className="h-4 w-4" />
            <AlertDescription>
              Once you delete your account, all your data will be permanently removed. This action cannot be undone.
            </AlertDescription>
          </Alert>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Icon name="trash" className="h-4 w-4" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>
                    This action will permanently delete your account and remove all associated data.
                  </p>
                  <p className="font-medium">
                    Please type <span className="font-mono bg-muted px-1 py-0.5 rounded">{userEmail}</span> to confirm.
                  </p>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    disabled={isDeleting}
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault()
                    handleDeleteAccount()
                  }}
                  disabled={isDeleting || deleteConfirmText !== userEmail}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Icon name="loader" className="animate-spin h-4 w-4" />
                      Deleting...
                    </>
                  ) : (
                    <>
                    <Icon name="trash" className="h-4 w-4" />
                    Delete Account  
                    </>
                  )}
                </AlertDialogAction>        
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}

