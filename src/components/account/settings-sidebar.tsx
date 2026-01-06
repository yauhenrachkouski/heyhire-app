"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconCreditCard, IconSettings, IconUser } from "@tabler/icons-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  { title: "Account", href: "/account", icon: IconUser },
  { title: "Organization", href: "/organization", icon: IconSettings },
  { title: "Billing", href: "/billing", icon: IconCreditCard },
]

export function SettingsSidebar() {
  const pathname = usePathname()
  const orgSegment = pathname?.split("/")[1]
  const basePath = orgSegment ? `/${orgSegment}` : ""

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const fullHref = `${basePath}${item.href}`
        const isActive =
          pathname === fullHref || pathname.startsWith(`${fullHref}/`)

        return (
          <Link
            key={item.href}
            href={fullHref}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              buttonVariants({
                variant: isActive ? "secondary" : "ghost",
                size: "sm",
              }),
              "justify-start gap-2"
            )}
          >
            <item.icon className="size-4" />
            {item.title}
          </Link>
        )
      })}
    </nav>
  )
}
