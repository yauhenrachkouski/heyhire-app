"use client"

import { DevTools } from "@/components/devtools"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { Toaster } from "sonner"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
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

