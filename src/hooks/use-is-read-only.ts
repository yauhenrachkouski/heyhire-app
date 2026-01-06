"use client"

import { usePathname } from "next/navigation"

export function useIsReadOnly() {
  const pathname = usePathname()

  // Preview routes are always read-only.
  if (pathname?.startsWith("/p/")) return true

  return false
}





