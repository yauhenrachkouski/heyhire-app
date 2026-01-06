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
        error: event.error,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Error) {
        log.error("unhandled_rejection", { source, error: event.reason });
      } else {
        log.error("unhandled_rejection", { source, reason: event.reason });
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
