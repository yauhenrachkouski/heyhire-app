import { NextRequest, NextResponse } from "next/server"
import { eq, and, lt } from "drizzle-orm"

import { db } from "@/db/drizzle"
import * as schema from "@/db/schema"
import { log } from "@/lib/axiom/server"

const source = "cron.cleanup-demo-users"

/**
 * Cron job to clean up old anonymous demo users.
 * Runs nightly and deletes anonymous users created more than 1 day ago.
 *
 * Vercel Cron: configured in vercel.json
 */
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    log.warn(`${source}.unauthorized`, { authHeader: !!authHeader })
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Find anonymous users created more than 1 day ago
    const oldAnonymousUsers = await db.query.user.findMany({
      where: and(
        eq(schema.user.isAnonymous, true),
        lt(schema.user.createdAt, oneDayAgo)
      ),
      columns: { id: true },
    })

    if (oldAnonymousUsers.length === 0) {
      log.info(`${source}.complete`, { deleted: 0 })
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: "No old anonymous users to clean up"
      })
    }

    const userIds = oldAnonymousUsers.map(u => u.id)

    // Delete users (cascade will handle sessions, members, accounts)
    for (const userId of userIds) {
      await db.delete(schema.user).where(eq(schema.user.id, userId))
    }

    log.info(`${source}.complete`, { deleted: userIds.length })

    return NextResponse.json({
      success: true,
      deleted: userIds.length,
      message: `Cleaned up ${userIds.length} anonymous users`,
    })
  } catch (error) {
    log.error(`${source}.failed`, { error: String(error) })
    return NextResponse.json(
      { error: "Cleanup failed", details: String(error) },
      { status: 500 }
    )
  }
}
