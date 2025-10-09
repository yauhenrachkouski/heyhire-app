import React from "react"
import Link from "next/link"
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
  // If no routes, show Home as current page
  if (routes.length === 0) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  let fullHref = ""
  const breadcrumbItems: React.ReactElement[] = []
  let breadcrumbPage: React.ReactElement = <></>

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i]
    const href = fullHref ? `${fullHref}/${route}` : `/${route}`
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
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/">Home</Link>
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
  )
}

