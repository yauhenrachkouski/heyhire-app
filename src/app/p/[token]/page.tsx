import Link from "next/link"
import { eq, desc } from "drizzle-orm"

import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { hashShareToken } from "@/lib/demo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default async function PreviewHome({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  // Layout already validated the token, just get org ID via lightweight lookup
  const tokenHash = hashShareToken(token)
  const link = await db.query.organizationShareLink.findFirst({
    where: eq(schema.organizationShareLink.tokenHash, tokenHash),
    columns: { organizationId: true },
  })
  const organizationId = link!.organizationId // Safe: layout already validated

  const searches = await db
    .select({
      id: schema.search.id,
      name: schema.search.name,
      createdAt: schema.search.createdAt,
      status: schema.search.status,
    })
    .from(schema.search)
    .where(eq(schema.search.organizationId, organizationId))
    .orderBy(desc(schema.search.createdAt))
    .limit(20)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Searches</h1>
          <p className="text-sm text-muted-foreground">
            This workspace is in preview mode. Create an account to request
            access.
          </p>
        </div>
      </div>

      {searches.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No searches yet</CardTitle>
            <CardDescription>
              This shared workspace doesn't have any saved searches.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {searches.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle className="truncate">{s.name}</CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span className="capitalize">{s.status}</span>
                  <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={`/p/${token}/search/${s.id}`}>Open</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
