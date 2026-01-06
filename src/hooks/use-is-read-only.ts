"use client"

import { useUserRole } from "@/stores/user-context-store"

export function useIsReadOnly() {
  const { isReadOnly } = useUserRole()
  return isReadOnly
}
