import { getPostHogServer } from "./posthog-server";
import { log } from "@/lib/axiom/server-log";

const LOG_SOURCE = "lib/posthog";

/**
 * Server-side PostHog event tracking.
 * Always requires explicit userId and organizationId - no fallbacks.
 *
 * @param userId - User ID (distinctId)
 * @param event - Event name (snake_case)
 * @param organizationId - Organization ID for group analytics
 * @param properties - Additional event properties
 */
export function trackServerEvent(
    userId: string,
    event: string,
    organizationId: string | undefined,
    properties?: Record<string, unknown>
): void {
    try {
        const posthog = getPostHogServer();
        posthog.capture({
            distinctId: userId,
            event,
            groups: organizationId ? { organization: organizationId } : undefined,
            properties: {
                organization_id: organizationId,
                ...properties,
            },
        });
    } catch (e) {
        log.error(LOG_SOURCE, "capture.error", { event, error: e });
    }
}

/**
 * Track an error event with consistent structure.
 */
export function trackServerError(
    userId: string,
    event: string,
    error: unknown,
    organizationId: string | undefined,
    properties?: Record<string, unknown>
): void {
    trackServerEvent(userId, event, organizationId, {
        ...properties,
        error: error instanceof Error ? error.message : String(error),
        error_type: error instanceof Error ? error.name : "unknown",
    });
}
