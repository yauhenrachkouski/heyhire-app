"use client"

import { usePathname } from "next/navigation"
import { useDemoMode } from "@/providers/demo-mode-provider"

export function useIsReadOnly() {
  const pathname = usePathname()
  const { isReadOnly } = useDemoMode()

  // Preview routes are always read-only
  if (pathname?.startsWith("/p/")) return true

  // Check demo mode context (handles demo_viewer role)
  if (isReadOnly) return true

  return false
}
