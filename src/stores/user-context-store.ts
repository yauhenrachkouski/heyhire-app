import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface User {
  id: string
  name: string
  email: string
}

export interface Organization {
  id: string
  name: string
}

export interface Subscription {
  plan: string
  status: string
  isTrialing: boolean
  credits: number
}

interface UserContextStore {
  // State
  user: User | null
  organization: Organization | null
  subscription: Subscription | null

  // Actions
  setUser: (user: User | null) => void
  setOrganization: (org: Organization | null) => void
  setSubscription: (sub: Subscription | null) => void
  clear: () => void
}

export const useUserContextStore = create<UserContextStore>()(
  devtools(
    (set) => ({
      user: null,
      organization: null,
      subscription: null,

      setUser: (user) => set({ user }, false, 'setUser'),
      setOrganization: (organization) => set({ organization }, false, 'setOrganization'),
      setSubscription: (subscription) => set({ subscription }, false, 'setSubscription'),
      clear: () => set({ user: null, organization: null, subscription: null }, false, 'clear'),
    }),
    { name: 'user-context' }
  )
)

// Non-reactive getter for use outside React components (e.g., logging)
export const getUserContext = () => {
  const { user, organization, subscription } = useUserContextStore.getState()
  return {
    userId: user?.id,
    userName: user?.name,
    userEmail: user?.email,
    organizationId: organization?.id,
    organizationName: organization?.name,
    plan: subscription?.plan,
    subscriptionStatus: subscription?.status,
    isTrialing: subscription?.isTrialing,
    credits: subscription?.credits,
  }
}
