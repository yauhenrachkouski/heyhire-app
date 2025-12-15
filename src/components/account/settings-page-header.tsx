"use client"

import type { ReactNode } from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export function SettingsPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}) {
  const pathname = usePathname()

  const navItems: Array<{ title: string; href: string }> = [
    { title: "Account", href: "/account" },
    { title: "Organization", href: "/organization" },
    { title: "Billing", href: "/billing" },
  ]

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2 sm:pt-1">{actions}</div>
        ) : null}
      </div>

      <nav className="flex flex-wrap gap-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                buttonVariants({
                  variant: isActive ? "secondary" : "ghost",
                  size: "sm",
                }),
                "justify-start"
              )}
            >
              {item.title}
            </Link>
          )
        })}
      </nav>

      <Separator />
    </div>
  )
}
