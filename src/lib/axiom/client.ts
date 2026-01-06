'use client';
import { Logger, LogLevel, ProxyTransport, ConsoleTransport, type Transport } from '@axiomhq/logging';
import { createUseLogger, createWebVitalsComponent } from '@axiomhq/react';
import { nextJsFormatters } from '@axiomhq/nextjs/client';

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
 * Simple client-side logger with debug filtering in production.
 * Automatically includes path/href from window.location.
 *
 * @example
 * import { log } from "@/lib/axiom/client";
 * import { useUserContext } from "@/hooks/use-user-context";
 *
 * const ctx = useUserContext();
 * log.info("Clicked", { ...ctx, itemId });
 */
export const log = {
  debug: (message: string, fields?: Record<string, unknown>) => {
    if (!isProduction) {
      const payload = addLocationFields(fields);
      logger.log(LogLevel.debug, message, payload);
    }
  },
  info: (message: string, fields?: Record<string, unknown>) => {
    const payload = addLocationFields(fields);
    logger.log(LogLevel.info, message, payload);
  },
  warn: (message: string, fields?: Record<string, unknown>) => {
    const payload = addLocationFields(fields);
    logger.log(LogLevel.warn, message, payload);
  },
  error: (message: string, fields?: Record<string, unknown>) => {
    const payload = addLocationFields(fields);
    logger.log(LogLevel.error, message, payload);
  },
};

function addLocationFields(fields?: Record<string, unknown>): Record<string, unknown> {
  if (typeof window === "undefined") return fields ?? {};
  return {
    ...fields,
    path: window.location.pathname,
    href: window.location.href,
  };
}

const useLogger = createUseLogger(logger);
const WebVitals = createWebVitalsComponent(logger);

export { useLogger, WebVitals };
