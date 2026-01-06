/**
 * Simple module-level store for logging context.
 * Used by Axiom client to inject user/org context into logs.
 * Updated by UserContextProvider when auth state changes.
 */

interface LoggingContext {
  userId?: string
  organizationId?: string
}

let context: LoggingContext = {}

export function setLoggingContext(ctx: LoggingContext) {
  context = ctx
}

export function getLoggingContext(): LoggingContext {
  return context
}

export function clearLoggingContext() {
  context = {}
}
