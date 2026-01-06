import { getSearchById } from "@/actions/search"
import { notFound } from "next/navigation"
import { SearchBreadcrumbClient } from "./search-breadcrumb-client"

export const dynamic = 'force-dynamic'

interface SearchBreadcrumbProps {
  params: Promise<{
    id: string
  }>
}

export default async function SearchBreadcrumb({ params }: SearchBreadcrumbProps) {
  const { id } = await params

  // Fetch the search to get its name for initial render
  const searchResult = await getSearchById(id)

  if (!searchResult.success || !searchResult.data) {
    notFound()
  }

  // Use client component that subscribes to React Query cache for live updates
  return <SearchBreadcrumbClient searchId={id} initialName={searchResult.data.name} />
}








