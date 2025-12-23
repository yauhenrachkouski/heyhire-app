import "server-only"

import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"

import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { generateId } from "@/lib/id"

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
  return process.env.DEMO_ORG_NAME || "Heyhire Demo"
}

/**
 * Hash a share token using SHA-256.
 * Tokens are never stored in plaintext.
 */
export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Ensure the demo organization exists, creating it if necessary.
 * Accepts an optional transaction for atomic operations.
 */
export async function ensureDemoOrganization(tx: typeof db = db) {
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
    credits: 0,
  })

  return id
}

