'use client';
import { Logger, ProxyTransport, ConsoleTransport, type Transport } from '@axiomhq/logging';
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

const useLogger = createUseLogger(logger);
const WebVitals = createWebVitalsComponent(logger);

export { useLogger, WebVitals };
