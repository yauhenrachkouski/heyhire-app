import axiomClient from "@/lib/axiom/axiom";
import { AxiomJSTransport, ConsoleTransport, EVENT, Logger, type Transport } from "@axiomhq/logging";
import {
  createAxiomRouteHandler,
  getLogLevelFromStatusCode,
  nextJsFormatters,
  transformRouteHandlerErrorResult,
  transformRouteHandlerSuccessResult,
} from "@axiomhq/nextjs";

const dataset = process.env.AXIOM_DATASET ?? process.env.NEXT_PUBLIC_AXIOM_DATASET;

if (!dataset) {
  throw new Error("AXIOM_DATASET (or NEXT_PUBLIC_AXIOM_DATASET) is required");
}

const serverTransports: [Transport, ...Transport[]] = [
  new AxiomJSTransport({ axiom: axiomClient, dataset }),
];

if (process.env.NODE_ENV !== "production") {
  serverTransports.push(new ConsoleTransport({ prettyPrint: true }));
}

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

const withRequestMeta = (
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
};

export const withAxiom = createAxiomRouteHandler(logger, {
  onSuccess: async (data) => {
    const [message, report] = transformRouteHandlerSuccessResult(data);
    withRequestMeta(report, data.req);
    logger.info(message, report);
    await logger.flush();
  },
  onError: async (error) => {
    if (error.error instanceof Error) {
      logger.error(error.error.message, error.error);
    }
    const [message, report] = transformRouteHandlerErrorResult(error);
    withRequestMeta(report, error.req);
    const statusCode = (report[EVENT]?.request?.statusCode as number) ?? 500;
    logger.log(getLogLevelFromStatusCode(statusCode), message, report);
    await logger.flush();
  },
});
