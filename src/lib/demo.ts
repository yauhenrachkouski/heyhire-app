import "server-only"

import { eq } from "drizzle-orm"

import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { generateId } from "@/lib/id"

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Get demo organization slug from environment.
 * Single source of truth for the demo org identifier.
 */
export function getDemoOrgSlug() {
  return process.env.DEMO_ORG_SLUG || "heyhire-demo"
}

/**
 * Get demo organization name from environment.
 */
export function getDemoOrgName() {
  return process.env.DEMO_ORG_NAME || "Demo"
}

/**
 * Ensure the demo organization exists, creating it if necessary.
 * Accepts an optional transaction for atomic operations.
 */
export async function ensureDemoOrganization(tx: DbOrTx = db) {
  const slug = getDemoOrgSlug()
  const name = getDemoOrgName()

  const existing = await tx.query.organization.findFirst({
    where: eq(schema.organization.slug, slug),
    columns: { id: true },
  })

  if (existing?.id) return existing.id

  const id = generateId()
  await tx.insert(schema.organization).values({
    id,
    name,
    slug,
    logo: null,
    googleLink: null,
    credits: 0,
  })

  return id
}
