import { PostHog } from "posthog-node"

let posthogInstance: PostHog | null = null

export function getPostHogServer() {
  if (!posthogInstance) {
    posthogInstance = new PostHog(
      (process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY)!,
      {
        host: process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST,
        flushAt: 1,
        flushInterval: 0,
        disabled: process.env.NODE_ENV === "development",
          
      }
    )
  }

  return posthogInstance
}