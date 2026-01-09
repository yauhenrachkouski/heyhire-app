"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/icon"

interface DemoIframeGuardProps {
  children: React.ReactNode
  /** If true, server already validated iframe context - skip client check */
  serverValidated?: boolean
}

/**
 * Client-side guard that ensures the demo is only accessible within an iframe.
 * This provides a fallback check since server-side headers (sec-fetch-dest, referer)
 * aren't always reliable across all browsers.
 */
export function DemoIframeGuard({ children, serverValidated = false }: DemoIframeGuardProps) {
  const [isInIframe, setIsInIframe] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if we're inside an iframe
    // window.self !== window.top returns true when in an iframe
    try {
      const inIframe = window.self !== window.top
      setIsInIframe(inIframe)
    } catch {
      // If we can't access window.top due to cross-origin restrictions,
      // we're definitely in an iframe
      setIsInIframe(true)
    }
  }, [])

  // While checking, show loading state
  if (isInIframe === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Icon name="loader" className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">Loading demo...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // If server already validated and we're in development, trust that
  // Otherwise, require iframe context
  if (!serverValidated && !isInIframe) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Icon name="lock" className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle>Demo Access Restricted</CardTitle>
            <CardDescription>
              The interactive demo is only available through our website.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <p className="text-center text-sm text-muted-foreground">
              Please visit our landing page to experience the HeyHire demo.
            </p>
            <Button asChild>
              <a href="https://heyhire.ai" target="_blank" rel="noopener noreferrer">
                Visit HeyHire
                <Icon name="external-link" className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
