'use client';
import { Logger, LogLevel, ProxyTransport, ConsoleTransport, type Transport } from '@axiomhq/logging';
import { createUseLogger, createWebVitalsComponent } from '@axiomhq/react';
import { nextJsFormatters } from '@axiomhq/nextjs/client';
import { getUserContext } from '@/stores/user-context-store';

const clientTransports: [Transport, ...Transport[]] = [
  new ProxyTransport({ url: `${process.env.NEXT_PUBLIC_APP_URL}/api/axiom`, autoFlush: true }),
];

if (process.env.NODE_ENV !== 'production') {
  clientTransports.push(new ConsoleTransport({ prettyPrint: true }));
}

export const logger = new Logger({
  transports: clientTransports,
  formatters: nextJsFormatters,
  args: {
    app: "heyhire-app",
    env: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  },
});

const isProduction = process.env.NODE_ENV === "production";

/**
 * Stringify complex objects into a single JSON field.
 * Use this for error logs where you need full context for debugging.
 *
 * @example
 * log.error("action.failed", { error: err.message, debug: stringify({ formData }) });
 */
export function stringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return "[unserializable]";
  }
}

/**
 * Client-side logger with automatic user/org context injection.
 * Automatically includes:
 * - userId, organizationId (from Zustand store when available)
 * - path, href (from window.location)
 *
 * @example
 * import { log, stringify } from "@/lib/axiom/client";
 *
 * // Info logs - auto context injected
 * log.info("Button clicked", { buttonId: "submit" });
 *
 * // Error logs - use stringify for full debug context
 * log.error("submit.failed", { error: err.message, debug: stringify({ formData }) });
 */
export const log = {
  debug: (message: string, fields?: Record<string, unknown>) => {
    if (!isProduction) {
      const payload = buildPayload(fields);
      logger.log(LogLevel.debug, message, payload);
    }
  },
  info: (message: string, fields?: Record<string, unknown>) => {
    const payload = buildPayload(fields);
    logger.log(LogLevel.info, message, payload);
  },
  warn: (message: string, fields?: Record<string, unknown>) => {
    const payload = buildPayload(fields);
    logger.log(LogLevel.warn, message, payload);
  },
  error: (message: string, fields?: Record<string, unknown>) => {
    const payload = buildPayload(fields);
    logger.log(LogLevel.error, message, payload);
  },
};

function buildPayload(fields?: Record<string, unknown>): Record<string, unknown> {
  // Get user context from Zustand store (non-reactive, safe outside React)
  const ctx = getUserContext();

  const base: Record<string, unknown> = {
    // Only include userId and organizationId if they exist
    ...(ctx.userId && { userId: ctx.userId }),
    ...(ctx.organizationId && { organizationId: ctx.organizationId }),
  };

  // Add location fields if in browser
  if (typeof window !== "undefined") {
    base.path = window.location.pathname;
    base.href = window.location.href;
  }

  // Merge with provided fields (fields take precedence)
  return { ...base, ...fields };
}

const useLogger = createUseLogger(logger);
const WebVitals = createWebVitalsComponent(logger);

export { useLogger, WebVitals };
