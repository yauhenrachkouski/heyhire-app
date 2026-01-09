"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authClient, useSession } from "@/lib/auth-client"
import { addDemoWorkspaceForCurrentUser } from "@/actions/demo"
import { IconLoader2 } from "@tabler/icons-react"

interface DemoAutoAuthProps {
  redirectTo?: string
}

export function DemoAutoAuth({ redirectTo }: DemoAutoAuthProps) {
  const router = useRouter()
  const { refetch } = useSession()
  const [status, setStatus] = useState<"signing-in" | "setting-up" | "redirecting" | "error">("signing-in")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function setupDemoAccess() {
      try {
        // Step 1: Sign in anonymously (with onSuccess to ensure completion)
        setStatus("signing-in")
        const { error: signInError } = await authClient.signIn.anonymous({
          fetchOptions: {
            onSuccess: () => {
              // Session cookie is now set - refetch to sync client state
              refetch()
            }
          }
        })

        if (signInError) {
          throw new Error(signInError.message || "Failed to sign in")
        }

        // Step 2: Add user to demo org with demo_viewer role
        setStatus("setting-up")
        const { success, organizationId } = await addDemoWorkspaceForCurrentUser()

        if (!success || !organizationId) {
          throw new Error("Failed to set up demo workspace")
        }

        // Step 3: Set active organization using client-side method
        // This ensures cookies are properly synced before navigation
        const { error: setOrgError } = await authClient.organization.setActive({
          organizationId,
        })

        if (setOrgError) {
          throw new Error(setOrgError.message || "Failed to set active organization")
        }

        // Step 4: Refetch session to ensure client state is synced
        await refetch()

        // Step 5: Redirect to demo org
        setStatus("redirecting")
        const destination = redirectTo || `/${organizationId}`
        router.push(destination)
        router.refresh()
      } catch (err) {
        console.error("Demo auth error:", err)
        setError(err instanceof Error ? err.message : "Something went wrong")
        setStatus("error")
      }
    }

    setupDemoAccess()
  }, [router, redirectTo, refetch])

  const messages = {
    "signing-in": "Creating demo session...",
    "setting-up": "Setting up demo workspace...",
    "redirecting": "Redirecting to demo...",
    "error": error || "Something went wrong",
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        {status !== "error" ? (
          <>
            <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{messages[status]}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-destructive">{messages[status]}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-primary underline"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  )
}
