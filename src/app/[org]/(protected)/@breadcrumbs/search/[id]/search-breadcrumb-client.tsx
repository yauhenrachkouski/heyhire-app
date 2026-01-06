"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { searchKeys } from "@/lib/query-keys/search"

interface SearchBreadcrumbClientProps {
  searchId: string
  initialName: string
}

export function SearchBreadcrumbClient({ searchId, initialName }: SearchBreadcrumbClientProps) {
  const pathname = usePathname()
  const orgSegment = pathname?.split("/")[1]
  const basePath = orgSegment ? `/${orgSegment}` : ""

  // Subscribe to search details cache - will update when name changes
  const { data: searchName } = useQuery({
    queryKey: searchKeys.detail(searchId),
    queryFn: () => initialName, // Fallback, but we primarily use cache updates
    initialData: initialName,
    staleTime: Infinity, // Don't refetch - we update via setQueryData
  })

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={basePath || "/"}>Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="max-w-[200px] truncate">
            {searchName}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
