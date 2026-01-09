import posthog from "posthog-js"

// Parse cross-domain tracking params from URL hash (passed from landing page iframe)
function getCrossOriginTrackingParams() {
  if (typeof window === 'undefined') return { distinctId: null, sessionId: null };

  const hash = window.location.hash.substring(1);
  if (!hash) return { distinctId: null, sessionId: null };

  const params = new URLSearchParams(hash);
  return {
    distinctId: params.get('ph_distinct_id'),
    sessionId: params.get('ph_session_id'),
  };
}

const { distinctId, sessionId } = getCrossOriginTrackingParams();

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: '2025-05-24',
  capture_exceptions: true,
  debug: process.env.NEXT_PUBLIC_POSTHOG_DEBUG === "true",
  cross_subdomain_cookie: true,
  persistence: 'localStorage+cookie',
  session_recording: {
    recordCrossOriginIframes: true,
  },
  // Bootstrap with landing page IDs for cross-domain user journey continuity
  bootstrap: distinctId ? {
    distinctID: distinctId,
    sessionID: sessionId || undefined,
  } : undefined,
});