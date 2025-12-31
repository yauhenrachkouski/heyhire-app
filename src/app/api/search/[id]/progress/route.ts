import { getSearchProgress } from "@/actions/candidates";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: searchId } = await params;
    
    console.log("[API] Fetching progress for search:", searchId);

    const progress = await getSearchProgress(searchId);
    
    return Response.json(progress);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[API] Error fetching progress:", errorMessage);

    const status =
      errorMessage === "Not authenticated"
        ? 401
        : errorMessage === "Not authorized"
          ? 403
          : errorMessage === "Search not found"
            ? 404
            : 500;

    return Response.json({ error: errorMessage }, { status });
  }
}

