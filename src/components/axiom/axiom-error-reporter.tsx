"use client";

import { useEffect } from "react";
import { log } from "@/lib/axiom/client-log";

const LOG_SOURCE = "components/error-reporter";

export function AxiomErrorReporter() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      log.error(LOG_SOURCE, "unhandled_error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Error) {
        log.error(LOG_SOURCE, "unhandled_rejection", { error: event.reason });
      } else {
        log.error(LOG_SOURCE, "unhandled_rejection", { reason: event.reason });
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
