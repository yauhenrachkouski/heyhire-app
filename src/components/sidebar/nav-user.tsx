"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Icon } from "@/components/ui/icon"
import { signOut } from "@/lib/auth-client"
import Link from "next/link"
import { useState } from "react"

// User type based on better-auth session
interface User {
  id: string
  name: string
  email: string
  image?: string | null
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

interface NavUserProps {
  user?: User | null
}

export function NavUser({ user: serverUser }: NavUserProps) {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const [isSigningOut, setIsSigningOut] = useState(false)

  if (!serverUser) {
    return null
  }

  const user = serverUser
  const userName = user.name || 'User'
  const userInitials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U'

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push('/auth/signin')
            router.refresh()
          }
        }
      })
    } catch (error) {
      setIsSigningOut(false)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              disabled={isSigningOut}
            >
              <Avatar className="h-8 w-8 rounded-full">
                {user.image && <AvatarImage src={user.image} alt={userName} />}
                <AvatarFallback className="rounded-full">{userInitials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{userName}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <Icon name="dots-vertical" className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-full">
                  {user.image && <AvatarImage src={user.image} alt={userName} />}
                  <AvatarFallback className="rounded-full">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{userName}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/account">
                  <Icon name="user" className="h-4 w-4" />
                  Account
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
              <Icon name="logout" className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
} 