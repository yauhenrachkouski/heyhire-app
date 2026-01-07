import { handle } from "@upstash/realtime";
import { realtime } from "@/lib/realtime";
import { withAxiom } from "@/lib/axiom/server";

// Match timeout to realtime config - 5 minutes
export const maxDuration = 300;

// Standard realtime handler
// Clients connect with: GET /api/realtime?channel=search:123
const realtimeHandler = handle({ realtime });

export const GET = withAxiom(async (request: Request) => {
  const response = await realtimeHandler(request);
  return response ?? new Response(null, { status: 204 });
});







