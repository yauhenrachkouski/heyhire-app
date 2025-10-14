"use client"

import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

export function DevTools() {
  return <ReactQueryDevtools initialIsOpen={false} />
}

