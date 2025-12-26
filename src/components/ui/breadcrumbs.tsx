"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface BreadcrumbsProps {
  routes?: string[]
}

function toTitleCase(str: string): string {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function Breadcrumbs({ routes = [] }: BreadcrumbsProps) {
  const pathname = usePathname()
  const orgSegment = pathname?.split("/")[1]
  const reservedSegments = new Set(["auth", "onboarding", "paywall", "p", "demo", "api"])
  const isOrgSegment = orgSegment && !reservedSegments.has(orgSegment)
  const basePath = isOrgSegment ? `/${orgSegment}` : ""
  const homePath = isOrgSegment ? basePath : "/"

  // If no routes, show Home as current page
  if (routes.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Home</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    )
  }

  let fullHref = ""
  const breadcrumbItems: React.ReactElement[] = []
  let breadcrumbPage: React.ReactElement = <></>

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i]
    const href = fullHref
      ? `${fullHref}/${route}`
      : basePath
        ? `${basePath}/${route}`
        : `/${route}`
    fullHref = href

    const label = toTitleCase(route)

    if (i === routes.length - 1) {
      breadcrumbPage = (
        <BreadcrumbItem key={href}>
          <BreadcrumbPage>{label}</BreadcrumbPage>
        </BreadcrumbItem>
      )
    } else {
      breadcrumbItems.push(
        <React.Fragment key={href}>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={href}>{label}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
        </React.Fragment>
      )
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={homePath}>Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {breadcrumbItems}
          {breadcrumbPage && (
            <>
              <BreadcrumbSeparator />
              {breadcrumbPage}
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
