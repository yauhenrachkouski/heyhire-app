"use client"

import { createContext, useContext, type ReactNode } from "react"
import { isReadOnlyRole, type Role } from "@/lib/roles"

interface DemoModeContextValue {
  isDemoMode: boolean
  isReadOnly: boolean
  role: string | null
}

const DemoModeContext = createContext<DemoModeContextValue>({
  isDemoMode: false,
  isReadOnly: false,
  role: null,
})

interface DemoModeProviderProps {
  children: ReactNode
  isDemoMode: boolean
  role: string | null
}

export function DemoModeProvider({ children, isDemoMode, role }: DemoModeProviderProps) {
  const isReadOnly = isDemoMode || isReadOnlyRole(role)

  return (
    <DemoModeContext.Provider value={{ isDemoMode, isReadOnly, role }}>
      {children}
    </DemoModeContext.Provider>
  )
}

export function useDemoMode() {
  return useContext(DemoModeContext)
}
