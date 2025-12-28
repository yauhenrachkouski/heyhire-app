import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"

import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { hashShareToken } from "@/lib/demo"
import { SearchResultsClient } from "@/app/[org]/(protected)/search/[id]/search-results-client"
import type { ParsedQuery } from "@/types/search"

interface PreviewSearchPageProps {
  params: Promise<{ token: string; id: string }>
}

export default async function PreviewSearchPage({
  params,
}: PreviewSearchPageProps) {
  const { token, id } = await params
  // Layout already validated the token, just get org ID via lightweight lookup
  const tokenHash = hashShareToken(token)
  const link = await db.query.organizationShareLink.findFirst({
    where: eq(schema.organizationShareLink.tokenHash, tokenHash),
    columns: { organizationId: true },
  })
  const organizationId = link!.organizationId // Safe: layout already validated

  const rows = await db
    .select({
      id: schema.search.id,
      name: schema.search.name,
      query: schema.search.query,
      params: schema.search.params,
      createdAt: schema.search.createdAt,
      status: schema.search.status,
      progress: schema.search.progress,
      organizationId: schema.search.organizationId,
      userId: schema.search.userId,
    })
    .from(schema.search)
    .where(eq(schema.search.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) notFound()
  if (row.organizationId !== organizationId) notFound()

  // Fetch user information
  const userRecord = await db.query.user.findFirst({
    where: eq(schema.user.id, row.userId),
    columns: {
      id: true,
      name: true,
      email: true,
    },
  })

  return (
    <>
      {/* Match protected search page background */}
      <div className="fixed inset-0 bg-sidebar -z-10" />
      <div className="container mx-auto">
        {/* Key ensures component remounts when navigating between searches */}
        <SearchResultsClient
          key={row.id}
          search={{
            id: row.id,
            name: row.name,
            query: row.query,
            params: JSON.parse(row.params) as ParsedQuery,
            createdAt: row.createdAt,
            status: row.status,
            progress: row.progress,
            createdBy: userRecord ? {
              id: userRecord.id,
              name: userRecord.name,
              email: userRecord.email,
            } : null,
          }}
        />
      </div>
    </>
  )
}
