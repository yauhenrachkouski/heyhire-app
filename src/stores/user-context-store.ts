import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { hasPermission, isReadOnlyRole, type Permission } from '@/lib/roles'

export interface User {
  id: string
  name: string
  email: string
  isAnonymous?: boolean
}

export interface Organization {
  id: string
  name: string
  slug?: string
}

export interface Subscription {
  plan: string
  status: string
  isTrialing: boolean
  credits: number
}

export interface Membership {
  role: string
  isDemoMode: boolean
}

interface UserContextState {
  user: User | null
  organization: Organization | null
  subscription: Subscription | null
  membership: Membership | null
}

interface UserContextActions {
  setUser: (user: User | null) => void
  setOrganization: (org: Organization | null) => void
  setSubscription: (sub: Subscription | null) => void
  setMembership: (membership: Membership | null) => void
  clear: () => void
}

type UserContextStore = UserContextState & UserContextActions

export const useUserContextStore = create<UserContextStore>()(
  devtools(
    (set) => ({
      user: null,
      organization: null,
      subscription: null,
      membership: null,

      setUser: (user) => set({ user }, false, 'setUser'),
      setOrganization: (organization) => set({ organization }, false, 'setOrganization'),
      setSubscription: (subscription) => set({ subscription }, false, 'setSubscription'),
      setMembership: (membership) => set({ membership }, false, 'setMembership'),
      clear: () => set({ user: null, organization: null, subscription: null, membership: null }, false, 'clear'),
    }),
    { name: 'user-context' }
  )
)

// Selectors
export const useUserRole = () => {
  const membership = useUserContextStore((s) => s.membership)
  const role = membership?.role ?? null
  const isDemoMode = membership?.isDemoMode ?? false
  const isReadOnly = isDemoMode || isReadOnlyRole(role)

  return {
    role,
    isDemoMode,
    isReadOnly,
    can: (permission: Permission) => hasPermission(role, permission),
  }
}

// Non-reactive getter for use outside React components (e.g., logging)
export const getUserContext = () => {
  const { user, organization, subscription, membership } = useUserContextStore.getState()
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
    role: membership?.role,
    isDemoMode: membership?.isDemoMode,
  }
}
