'use client';

import { LogLevel } from "@axiomhq/logging";
import { logger } from "@/lib/axiom/client";
import { getUserContext } from "@/stores/user-context-store";
import type { LogFields } from "@/lib/axiom/log-types";

const isProduction = process.env.NODE_ENV === "production";

// Flatten nested objects to prevent Axiom column explosion
// Nested objects create new columns for each unique field path
const flattenFields = (fields: LogFields): LogFields => {
  const result: LogFields = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) {
      result[key] = value;
    } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Error)) {
      // Serialize nested objects to JSON string to avoid column proliferation
      result[key] = JSON.stringify(value);
    } else if (Array.isArray(value)) {
      // Serialize arrays to JSON string
      result[key] = JSON.stringify(value);
    } else {
      result[key] = value;
    }
  }

  return result;
};

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

  const userContext = getUserContext();
  const payload: LogFields = {
    source,
    ...userContext,
    ...flattenFields(fields ?? {}),
  };
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
