"use client"

import { DevTools } from "@/components/devtools"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RealtimeProvider } from "@upstash/realtime/client"
import { useState } from "react"
import { Toaster } from "sonner"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider
        api={{ url: "/api/realtime", withCredentials: false }}
        maxReconnectAttempts={5}
      >
        {children}
      </RealtimeProvider>
      {process.env.NODE_ENV === "development" && <DevTools />}
    </QueryClientProvider>
  )
}

export function ToasterProvider({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster richColors />
    </>
  )
}

