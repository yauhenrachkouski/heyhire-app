"use client"

import { useRouter } from "next/navigation"
import { IconUserPlus } from "@tabler/icons-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface CreateAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Check if the current window is embedded in an iframe
 */
function isInIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    // If we can't access window.top due to cross-origin, we're in an iframe
    return true
  }
}

export function CreateAccountModal({ open, onOpenChange }: CreateAccountModalProps) {
  const router = useRouter()

  const handleCreateAccount = () => {
    onOpenChange(false)

    // If embedded in iframe, notify parent window to handle signup
    if (isInIframe()) {
      window.parent.postMessage(
        {
          type: "HEYHIRE_CREATE_ACCOUNT",
          action: "signup",
        },
        "*" // In production, replace with your landing page origin for security
      )
      return
    }

    // Otherwise navigate within the app
    router.push("/auth/signin")
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <IconUserPlus className="text-primary" />
          </AlertDialogMedia>
          <AlertDialogTitle>Create an account to search</AlertDialogTitle>
          <AlertDialogDescription>
            Sign up to create custom searches and find the perfect candidates for your team.
            It only takes a minute to get started.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleCreateAccount}>
            Create Account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
