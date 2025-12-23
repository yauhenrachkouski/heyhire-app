import { notFound } from "next/navigation"
import Link from "next/link"
import { cookies } from "next/headers"
import { eq } from "drizzle-orm"

import { validateAndTrackShareToken, validateShareToken } from "@/actions/share-links"
import { Button } from "@/components/ui/button"
import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"

export default async function PreviewLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const cookieStore = await cookies()
  const isFirstVisit = cookieStore.get("hh_preview_first")?.value === "1"

  let organizationId: string

  try {
    // Only track view count on first visit to this token
    if (isFirstVisit) {
      const result = await validateAndTrackShareToken(token)
      organizationId = result.organizationId
    } else {
      const result = await validateShareToken(token)
      organizationId = result.organizationId
    }
  } catch {
    notFound()
  }

  // Fetch organization name for the banner
  const org = await db.query.organization.findFirst({
    where: eq(schema.organization.id, organizationId),
    columns: { name: true },
  })

  return (
    <div className="min-h-svh">
      <div className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="text-sm text-muted-foreground">
            Previewing: <span className="font-medium">{org?.name ?? "Workspace"}</span> (read-only)
          </div>
          <Button asChild variant="default">
            <Link href="/auth/signin">Sign up to interact</Link>
          </Button>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  )
}


