import { getPostHogServer } from "./posthog-server";
import { log } from "@/lib/axiom/server-log";

/**
 * Server-side PostHog event tracking helper.
 * Handles try-catch and consistent event structure.
 * 
 * @param distinctId - User ID for the event
 * @param event - Event name (snake_case, e.g., "checkout_started")
 * @param organizationId - Optional organization ID for group analytics
 * @param properties - Additional event properties
 */
export function trackServerEvent(
    distinctId: string,
    event: string,
    organizationId?: string,
    properties?: Record<string, unknown>
): void {
    try {
        const posthog = getPostHogServer();
        posthog.capture({
            distinctId,
            event,
            groups: organizationId ? { organization: organizationId } : undefined,
            properties: {
                organization_id: organizationId,
                ...properties,
            },
        });
    } catch (e) {
        log.error("PostHog", "Failed to capture event", { event, error: e });
    }
}

/**
 * Track an error event with consistent structure
 */
export function trackServerError(
    distinctId: string,
    event: string,
    error: unknown,
    organizationId?: string,
    properties?: Record<string, unknown>
): void {
    trackServerEvent(distinctId, event, organizationId, {
        ...properties,
        error: error instanceof Error ? error.message : String(error),
        error_type: error instanceof Error ? error.name : "unknown",
    });
}
