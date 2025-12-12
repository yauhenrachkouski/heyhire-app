import { handle } from '@upstash/realtime';
import { realtime } from '@/lib/realtime';

// Match timeout to realtime config - 5 minutes
export const maxDuration = 300;

// Standard realtime handler
// Clients connect with: GET /api/realtime?channel=search:123
export const GET = handle({ realtime });



