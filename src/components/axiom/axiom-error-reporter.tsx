"use client";

import { useEffect } from "react";
import { log } from "@/lib/axiom/client";

const source = "components/error-reporter";

export function AxiomErrorReporter() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      log.error("unhandled_error", {
        source,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error instanceof Error ? event.error.message : String(event.error),
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);
      log.error("unhandled_rejection", { source, error: errorMessage });
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
