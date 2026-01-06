"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { addDemoWorkspaceForCurrentUser, setActiveOrganization } from "@/actions/demo"
import { IconLoader2 } from "@tabler/icons-react"

interface DemoAutoAuthProps {
  redirectTo?: string
}

export function DemoAutoAuth({ redirectTo }: DemoAutoAuthProps) {
  const router = useRouter()
  const [status, setStatus] = useState<"signing-in" | "setting-up" | "redirecting" | "error">("signing-in")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function setupDemoAccess() {
      try {
        // Step 1: Sign in anonymously
        setStatus("signing-in")
        const { error: signInError } = await authClient.signIn.anonymous()

        if (signInError) {
          throw new Error(signInError.message || "Failed to sign in")
        }

        // Step 2: Add user to demo org with demo_viewer role
        setStatus("setting-up")
        const { success, organizationId } = await addDemoWorkspaceForCurrentUser()

        if (!success || !organizationId) {
          throw new Error("Failed to set up demo workspace")
        }

        // Step 3: Set active organization
        await setActiveOrganization(organizationId)

        // Step 4: Redirect to demo org
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
  }, [router, redirectTo])

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
