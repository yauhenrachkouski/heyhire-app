"use client";

import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils";

interface SearchIslandProps extends React.ComponentProps<"div"> {
  visible?: boolean;
  container?: Element | DocumentFragment | null;
  children?: React.ReactNode;
  className?: string;
}

export function SearchIsland({
  visible: visibleProp = true,
  container: containerProp,
  className,
  children,
}: SearchIslandProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const container =
    containerProp ?? (mounted ? globalThis.document?.body : null);

  if (!container) return null;

  const visible = visibleProp;

  return ReactDOM.createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center pointer-events-none",
            className,
          )}
        >
          <div className="w-full max-w-2xl flex flex-col gap-4 px-4 pointer-events-auto">
            <div className="flex flex-col gap-2">
              <label className="text-sm text-white">
                Who are you searching for?
              </label>
            </div>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    container,
  );
}
