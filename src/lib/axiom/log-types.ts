/**
 * Common fields for logging context
 */
export interface CommonLogFields {
  userId?: string;
  organizationId?: string;
  requestId?: string;
  searchId?: string;
  duration?: number;
  error?: unknown;
  errorStack?: string;
}

/**
 * Typed log fields with common fields + arbitrary additional fields
 */
export type LogFields = CommonLogFields & Record<string, unknown>;

/**
 * Context for logWithContext helper
 */
export interface LogContext {
  userId?: string;
  organizationId?: string;
  requestId?: string;
  searchId?: string;
}

/**
 * Result of a timed operation
 */
export interface TimedResult<T> {
  result: T;
  duration: number;
}
