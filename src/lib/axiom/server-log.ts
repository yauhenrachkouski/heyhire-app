import { LogLevel } from "@axiomhq/logging";
import { logger } from "@/lib/axiom/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { LogFields, LogContext } from "@/lib/axiom/log-types";

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

  const payload = fields ? { source, ...flattenFields(fields) } : { source };
  logger.log(level, message, payload);
  // Note: Flush is handled by withAxiom route handler or after() for API routes.
  // For server actions, logs are batched and flushed automatically.
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

/**
 * Creates a logger with pre-injected context (userId, organizationId, requestId)
 * Use this when you have session context available to automatically include
 * user and organization info in all subsequent logs.
 *
 * @example
 * const ctxLog = logWithContext("api/search", { userId: session.userId, organizationId: orgId });
 * ctxLog.info("Search started", { query: "engineer" });
 * ctxLog.error("Search failed", { error: err.message });
 */
export const logWithContext = (source: string, context: LogContext) => {
  const mergeContext = (fields?: LogFields): LogFields => ({
    ...context,
    ...fields,
  });

  return {
    debug: (message: string, fields?: LogFields) =>
      log.debug(source, message, mergeContext(fields)),
    info: (message: string, fields?: LogFields) =>
      log.info(source, message, mergeContext(fields)),
    warn: (message: string, fields?: LogFields) =>
      log.warn(source, message, mergeContext(fields)),
    error: (message: string, fields?: LogFields) =>
      log.error(source, message, mergeContext(fields)),
  };
};

/**
 * Measures and logs the duration of an async operation.
 *
 * @example
 * const result = await logTimed(
 *   "api/search",
 *   "Database query",
 *   async () => db.query.searches.findMany(),
 *   { userId, searchId }
 * );
 */
export async function logTimed<T>(
  source: string,
  message: string,
  fn: () => Promise<T>,
  fields?: LogFields
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    log.info(source, `${message} completed`, { ...fields, duration });
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    log.error(source, `${message} failed`, {
      ...fields,
      duration,
      error: errorMessage,
      errorStack,
    });
    throw error;
  }
}

/**
 * Measures duration without logging (returns result with duration).
 * Useful when you want to include duration in a custom log message.
 *
 * @example
 * const { result, duration } = await measureDuration(async () => fetchCandidates());
 * log.info("api/candidates", "Fetched candidates", { count: result.length, duration });
 */
export async function measureDuration<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = Math.round(performance.now() - start);
  return { result, duration };
}

/**
 * Creates a logger with auto-fetched session context (userId, organizationId).
 * Call this at the start of server actions or API routes.
 *
 * @example
 * const ctxLog = await getLogger("api/search");
 * ctxLog.info("Search started", { query: "engineer" });
 */
export async function getLogger(source: string) {
  try {
    const [session, activeOrg] = await Promise.all([
      auth.api.getSession({ headers: await headers() }),
      auth.api.getFullOrganization({ headers: await headers() }),
    ]);

    return logWithContext(source, {
      userId: session?.user?.id,
      organizationId: activeOrg?.id,
    });
  } catch {
    // Fallback to basic logger if session fetch fails
    return logWithContext(source, {});
  }
}
