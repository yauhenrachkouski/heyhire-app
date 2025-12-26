import { Breadcrumbs } from "@/components/custom/breadcrumbs"
import { getSearchById } from "@/actions/search"
import { notFound } from "next/navigation"

export const dynamic = 'force-dynamic'

interface SearchBreadcrumbProps {
  params: Promise<{
    id: string
  }>
}

export default async function SearchBreadcrumb({ params }: SearchBreadcrumbProps) {
  const { id } = await params
  
  // Fetch the search to get its name
  const searchResult = await getSearchById(id)
  
  if (!searchResult.success || !searchResult.data) {
    notFound()
  }
  
  const searchName = searchResult.data.name
  
  // Return breadcrumbs with: Home > Search > [Search Name]
  return <Breadcrumbs routes={['search', searchName]} />
}








