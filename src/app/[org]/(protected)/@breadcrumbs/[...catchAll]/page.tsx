import { Breadcrumbs } from "@/components/breadcrumbs"

export const dynamic = 'force-dynamic'

interface BreadcrumbSlotProps {
  params: Promise<{
    catchAll: string[]
  }>
}

export default async function BreadcrumbSlot({ params }: BreadcrumbSlotProps) {
  const { catchAll } = await params
  return <Breadcrumbs routes={catchAll} />
}

