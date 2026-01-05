'use client';

import { LogLevel } from "@axiomhq/logging";
import { logger } from "@/lib/axiom/client";
import type { LogFields } from "@/lib/axiom/log-types";

const isProduction = process.env.NODE_ENV === "production";

const logWithLevel = (
  level: LogLevel,
  source: string,
  message: string,
  fields?: LogFields
) => {
  // Skip debug logs in production to reduce noise
  if (isProduction && level === LogLevel.debug) {
    return;
  }

  const payload: LogFields = fields ? { source, ...fields } : { source };
  if (typeof window !== "undefined") {
    payload.path = window.location.pathname;
    payload.href = window.location.href;
  }
  logger.log(level, message, payload);
};

export const log = {
  debug: (source: string, message: string, fields?: LogFields) =>
    logWithLevel(LogLevel.debug, source, message, fields),
  info: (source: string, message: string, fields?: LogFields) =>
    logWithLevel(LogLevel.info, source, message, fields),
  warn: (source: string, message: string, fields?: LogFields) =>
    logWithLevel(LogLevel.warn, source, message, fields),
  error: (source: string, message: string, fields?: LogFields) =>
    logWithLevel(LogLevel.error, source, message, fields),
};
