#!/usr/bin/env bun
/**
 * Test script for cursor-based pagination
 * Run with: bun scripts/test-cursor-pagination.ts <searchId>
 */

import { db } from "../src/db/drizzle";
import { searchCandidates } from "../src/db/schema";
import { eq, and, lt, desc, count, or, sql } from "drizzle-orm";

const DEBUG_ENDPOINT = "http://127.0.0.1:7242/ingest/0cd1b653-bec9-4bbb-b583-c1c514b1bb69";

async function log(message: string, data: Record<string, unknown>) {
  console.log(`[DEBUG] ${message}`, JSON.stringify(data, null, 2));
  try {
    await fetch(DEBUG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "test-cursor-pagination.ts",
        message,
        data,
        timestamp: Date.now(),
        sessionId: "cli-test",
        hypothesisId: "CLI",
      }),
    });
  } catch {}
}

type CandidatesCursor = {
  sortBy: "date-desc" | "date-asc";
  lastId: string;
  createdAt: string;
};

function encodeCursor(cursor: CandidatesCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CandidatesCursor | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    return JSON.parse(raw) as CandidatesCursor;
  } catch {
    return null;
  }
}

async function testPagination(searchId: string) {
  const LIMIT = 20;
  
  // 1. Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(searchCandidates)
    .where(eq(searchCandidates.searchId, searchId));
  
  const totalCount = totalResult?.count || 0;
  console.log(`\n📊 Total candidates in search: ${totalCount}\n`);
  
  await log("Total count", { searchId, totalCount });
  
  // 2. Paginate through all results
  let cursor: string | null = null;
  let pageNum = 0;
  let allFetched: string[] = [];
  const allTimestamps: { id: string; createdAt: Date; createdAtIso: string; createdAtMs: number }[] = [];
  
  while (true) {
    pageNum++;
    const parsedCursor = cursor ? decodeCursor(cursor) : null;
    
    console.log(`\n📄 Page ${pageNum}:`);
    console.log(`   Cursor: ${parsedCursor ? JSON.stringify(parsedCursor) : "null"}`);
    
    // Build cursor condition
    const conditions = [eq(searchCandidates.searchId, searchId)];
    
    if (parsedCursor) {
      const cursorDate = new Date(parsedCursor.createdAt);
      const cursorMs = cursorDate.getTime();
      console.log(`   Cursor date: ${cursorDate.toISOString()}`);
      console.log(`   Cursor date ms: ${cursorMs}`);
      console.log(`   Cursor lastId: ${parsedCursor.lastId}`);
      
      await log("Parsing cursor", {
        pageNum,
        cursorCreatedAt: parsedCursor.createdAt,
        cursorDateIso: cursorDate.toISOString(),
        cursorDateMs: cursorMs,
        cursorLastId: parsedCursor.lastId,
      });
      
      // Range-based comparison (optimized for index usage):
      // - createdAt < cursor_floor (strictly before the millisecond)
      // - OR (createdAt within same millisecond AND id < cursorId)
      const floorMs = cursorMs;
      const ceilMs = cursorMs + 1;
      conditions.push(
        sql`((${searchCandidates.createdAt} < to_timestamp(${floorMs}::double precision / 1000)) OR (${searchCandidates.createdAt} >= to_timestamp(${floorMs}::double precision / 1000) AND ${searchCandidates.createdAt} < to_timestamp(${ceilMs}::double precision / 1000) AND ${searchCandidates.id} < ${parsedCursor.lastId}))`
      );
      
      console.log(`   Range: createdAt < ${cursorDate.toISOString()} OR (same ms AND id < ${parsedCursor.lastId.slice(0, 8)}...)`);
    }
    
    // Execute query
    const results = await db.query.searchCandidates.findMany({
      where: and(...conditions),
      columns: {
        id: true,
        createdAt: true,
        candidateId: true,
      },
      limit: LIMIT + 1,
      orderBy: [desc(searchCandidates.createdAt), desc(searchCandidates.id)],
    });
    
    const hasMore = results.length > LIMIT;
    const pageResults = hasMore ? results.slice(0, LIMIT) : results;
    
    console.log(`   Fetched: ${pageResults.length} (hasMore: ${hasMore})`);
    
    // Check for duplicates
    const pageIds = pageResults.map(r => r.id);
    const duplicates = pageIds.filter(id => allFetched.includes(id));
    if (duplicates.length > 0) {
      console.log(`   ⚠️  DUPLICATES FOUND: ${duplicates.join(", ")}`);
      await log("Duplicates detected", { pageNum, duplicates });
    }
    
    allFetched.push(...pageIds);
    
    // Log timestamps for this page
    for (const r of pageResults) {
      allTimestamps.push({
        id: r.id,
        createdAt: r.createdAt,
        createdAtIso: r.createdAt.toISOString(),
        createdAtMs: r.createdAt.getTime(),
      });
    }
    
    // Log first and last result
    const first = pageResults[0];
    const last = pageResults[pageResults.length - 1];
    
    if (first) {
      console.log(`   First: id=${first.id.slice(0, 8)}... createdAt=${first.createdAt.toISOString()}`);
    }
    if (last) {
      console.log(`   Last:  id=${last.id.slice(0, 8)}... createdAt=${last.createdAt.toISOString()}`);
    }
    
    await log("Page results", {
      pageNum,
      count: pageResults.length,
      hasMore,
      firstId: first?.id,
      firstCreatedAt: first?.createdAt.toISOString(),
      firstCreatedAtMs: first?.createdAt.getTime(),
      lastId: last?.id,
      lastCreatedAt: last?.createdAt.toISOString(),
      lastCreatedAtMs: last?.createdAt.getTime(),
    });
    
    if (!hasMore) {
      break;
    }
    
    // Build next cursor
    cursor = encodeCursor({
      sortBy: "date-desc",
      lastId: last!.id,
      createdAt: last!.createdAt.toISOString(),
    });
  }
  
  // 3. Summary
  console.log(`\n📊 Summary:`);
  console.log(`   Total in DB: ${totalCount}`);
  console.log(`   Total fetched: ${allFetched.length}`);
  console.log(`   Pages: ${pageNum}`);
  
  if (allFetched.length !== totalCount) {
    console.log(`\n   ❌ MISMATCH! Expected ${totalCount}, got ${allFetched.length}`);
    console.log(`   Missing: ${totalCount - allFetched.length} candidates`);
    
    // Check for timestamp clusters (same timestamp)
    const timestampCounts = new Map<number, number>();
    for (const t of allTimestamps) {
      const ms = t.createdAtMs;
      timestampCounts.set(ms, (timestampCounts.get(ms) || 0) + 1);
    }
    
    const clusters = Array.from(timestampCounts.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);
    
    if (clusters.length > 0) {
      console.log(`\n   ⚠️  Timestamp clusters (same ms):`);
      for (const [ms, count] of clusters.slice(0, 5)) {
        console.log(`      ${new Date(ms).toISOString()}: ${count} records`);
      }
      
      await log("Timestamp clusters", {
        totalClusters: clusters.length,
        topClusters: clusters.slice(0, 5).map(([ms, count]) => ({
          timestamp: new Date(ms).toISOString(),
          count,
        })),
      });
    }
  } else {
    console.log(`\n   ✅ All candidates fetched successfully!`);
  }
  
  await log("Final summary", {
    totalCount,
    fetched: allFetched.length,
    pages: pageNum,
    success: allFetched.length === totalCount,
  });
}

// Main
const searchId = process.argv[2];

if (!searchId) {
  console.error("Usage: bun scripts/test-cursor-pagination.ts <searchId>");
  console.error("\nTo find a searchId, run:");
  console.error("  bun -e 'const {db}=require(\"./src/db/drizzle\");const {search}=require(\"./src/db/schema\");db.query.search.findMany({limit:5,orderBy:[(s)=>s.createdAt.desc()]}).then(r=>r.forEach(s=>console.log(s.id,s.name)))'");
  process.exit(1);
}

testPagination(searchId)
  .then(() => {
    console.log("\n✅ Test complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Test failed:", err);
    process.exit(1);
  });

