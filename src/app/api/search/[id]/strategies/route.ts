import { getSourcingStrategiesForSearch } from "@/actions/search";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: searchId } = await params;
    const result = await getSourcingStrategiesForSearch(searchId);

    if (!result.success) {
      return Response.json({ error: result.error || "Failed to load" }, { status: 500 });
    }

    return Response.json({ strategies: result.data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status =
      message === "Not authenticated"
        ? 401
        : message === "Not authorized"
          ? 403
          : message === "Search not found"
            ? 404
            : 500;
    return Response.json({ error: message }, { status });
  }
}


