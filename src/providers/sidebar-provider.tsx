"use client"

import { log } from "@/lib/axiom/client-log";

const LOG_SOURCE = "providers/sidebar";

import { SidebarProvider } from "@/components/ui/sidebar"
import { useEffect, useState } from "react"

export function PersistentSidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true) // Start with default value
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_state')
      if (saved !== null) {
        setOpen(saved === 'true')
      }
    } catch (error) {
      log.warn(LOG_SOURCE, "read_state.error", { error })
    } finally {
      setHydrated(true)
    }
  }, [])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (hydrated) { // Only save after hydration
      try {
        localStorage.setItem('sidebar_state', String(newOpen))
      } catch (error) {
        log.warn(LOG_SOURCE, "save_state.error", { error })
      }
    }
  }

  return (
    <SidebarProvider open={open} onOpenChange={handleOpenChange}>
      {children}
    </SidebarProvider>
  )
}
