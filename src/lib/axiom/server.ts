import axiomClient from "@/lib/axiom/axiom";
import { AxiomJSTransport, ConsoleTransport, EVENT, Logger, LogLevel, type Transport } from "@axiomhq/logging";
import {
  createAxiomRouteHandler,
  getLogLevelFromStatusCode,
  nextJsFormatters,
  transformRouteHandlerErrorResult,
  transformRouteHandlerSuccessResult,
} from "@axiomhq/nextjs";
import { auth } from "@/lib/auth";

const isProduction = process.env.NODE_ENV === "production";
const dataset = process.env.AXIOM_DATASET ?? process.env.NEXT_PUBLIC_AXIOM_DATASET;

if (isProduction && !dataset) {
  throw new Error("AXIOM_DATASET (or NEXT_PUBLIC_AXIOM_DATASET) is required in production");
}

const serverTransports: [Transport, ...Transport[]] = isProduction
  ? [new AxiomJSTransport({ axiom: axiomClient, dataset: dataset! })]
  : [new ConsoleTransport({ prettyPrint: true })];

export const logger = new Logger({
  transports: serverTransports,
  formatters: nextJsFormatters,
  args: {
    app: "heyhire-app",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  },
});

/**
 * Stringify complex objects into a single JSON field.
 * Use this for error logs where you need full context for debugging
 * without exploding Axiom key limits.
 *
 * @example
 * log.error("parse.failed", {
 *   source,
 *   error: err.message,
 *   debug: stringify({ criteria, response }), // single field with full data
 * });
 */
export function stringify(data: unknown): string {
  try {
    return JSON.stringify(data);
  } catch {
    return "[unserializable]";
  }
}

/**
 * Server-side logger with debug filtering in production.
 *
 * @example
 * import { log, stringify } from "@/lib/axiom/server";
 * import { getSessionWithOrg } from "@/lib/auth-helpers";
 *
 * // Info logs - use flat fields
 * log.info("parse.done", { source, jobTitle, criteriaCount: 4 });
 *
 * // Error logs - use stringify for full debug context
 * log.error("parse.failed", {
 *   userId, organizationId: activeOrgId,
 *   error: err.message,
 *   debug: stringify({ criteria, response }),
 * });
 */
export const log = {
  debug: (message: string, fields?: Record<string, unknown>) => {
    if (!isProduction) logger.log(LogLevel.debug, message, fields);
  },
  info: (message: string, fields?: Record<string, unknown>) => {
    logger.log(LogLevel.info, message, fields);
  },
  warn: (message: string, fields?: Record<string, unknown>) => {
    logger.log(LogLevel.warn, message, fields);
  },
  error: (message: string, fields?: Record<string, unknown>) => {
    logger.log(LogLevel.error, message, fields);
  },
};

const withRequestMeta = async (
  report: Record<string | symbol, any>,
  req: Request | { headers: Headers; nextUrl?: URL }
) => {
  const event = report[EVENT];
  if (!event || !event.request) return;

  const requestId =
    req.headers.get("x-request-id") ??
    req.headers.get("x-vercel-id") ??
    req.headers.get("x-amzn-trace-id") ??
    undefined;

  event.request.requestId = requestId;

  if ("nextUrl" in req && req.nextUrl) {
    event.request.searchParams = Object.fromEntries(req.nextUrl.searchParams);
  }

  // Add user context if available
  try {
    const headers = req instanceof Request ? req.headers : req.headers;
    const session = await auth.api.getSession({ headers });
    
    if (session?.user) {
      report.userId = session.user.id;
      if (session.session?.activeOrganizationId) {
        report.organizationId = session.session.activeOrganizationId;
      }
    }
  } catch {
    // Silently fail if session cannot be retrieved (e.g., unauthenticated requests)
    // This is expected for public routes
  }
};

export const withAxiom = createAxiomRouteHandler(logger, {
  onSuccess: async (data) => {
    const [message, report] = transformRouteHandlerSuccessResult(data);
    await withRequestMeta(report, data.req);
    logger.info(message, report);
    await logger.flush();
  },
  onError: async (error) => {
    if (error.error instanceof Error) {
      logger.error(error.error.message, error.error);
    }
    const [message, report] = transformRouteHandlerErrorResult(error);
    await withRequestMeta(report, error.req);
    const statusCode = (report[EVENT]?.request?.statusCode as number) ?? 500;
    logger.log(getLogLevelFromStatusCode(statusCode), message, report);
    await logger.flush();
  },
});
