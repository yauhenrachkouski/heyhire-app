import { Redis } from '@upstash/redis';
import { Realtime, type InferRealtimeEvents } from '@upstash/realtime';
import { z } from "zod";

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('Redis credentials are missing');
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const schema = {
  status: {
    updated: z.object({
      status: z.string(),
      message: z.string(),
      progress: z.number().optional(),
    }),
  },
  search: {
    failed: z.object({
      error: z.string(),
    }),
    completed: z.object({
      candidatesCount: z.number(),
      status: z.string(),
    }),
  },
  progress: {
    updated: z.object({
      progress: z.number(),
      message: z.string(),
    }),
  },
};

export const realtime = new Realtime({
  redis,
  schema,
});

// Export type for use in useRealtime hook
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>;

